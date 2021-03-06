import * as xml2js from "xml2js";
import * as fs from "fs";
import * as Path from "path";
const filesize = require("filesize");
import * as mobx from "mobx";
import * as assert from "assert";
const camelcase = require("camelcase");
const imagesize = require("image-size");
import { Field, FieldType, FieldDefinition } from "../field/Field";
import { FieldSet } from "../field/FieldSet";
import * as xmlbuilder from "xmlbuilder";
import { locate } from "../../crossPlatformUtilities";
const moment = require("moment");
const titleCase = require("title-case");

export class Contribution {
  //review this @mobx.observable
  @mobx.observable public name: string;
  @mobx.observable public role: string;
  @mobx.observable public date: string;
  @mobx.observable public comments: string;
}

export abstract class File {
  // can be changed to Session, Project, or Person in constructor
  //protected xmlRootName: string = "MetaData";

  // In the case of folder objects (project, session, people) this will just be the metadata file,
  // and so describedFilePath === metadataPath.
  // In all other cases (mp3, jpeg, elan, txt), this will be the file we are storing metadata about.
  @mobx.observable public describedFilePath: string;

  // This file can be *just* metadata for a folder, in which case it has the fileExtensionForFolderMetadata.
  // But it can also be paired with a file in the folder, such as an image, sound, video, elan file, etc.,
  // in which case the metadata will be stored in afile with the same name as the described file, but
  // with an extension of ".meta", as in "banquet.jpg.meta";
  public metadataFilePath: string;

  private xmlRootName: string;
  private fileExtensionForMetadata: string;
  public canDelete: boolean;

  @mobx.observable public properties = new FieldSet();

  @mobx.observable public contributions = new Array<Contribution>();

  get type(): string {
    const x = this.properties.getValue("type") as Field;
    return x ? x.text : "???";
  }
  private checkType(key: string, value: any) {
    if (this.properties.containsKey(key)) {
      const a = typeof this.properties.getValueOrThrow(key);
      const b = typeof value;
      assert.ok(a === b, `Cannot change type of ${key} from ${a} to ${b}`);
    }
  }
  protected addDatePropertyFromString(key: string, dateString: string) {
    // get a little paranoid with the date format
    assert.ok(moment(dateString).isValid()); //todo: handle bad data
    const date = new Date(Date.parse(dateString));
    this.checkType(key, date);
    const dateWeTrust = date.toISOString();
    this.properties.setValue(key, new Field(key, FieldType.Date, dateWeTrust));
  }
  protected addDateProperty(key: string, date: Date) {
    this.checkType(key, date);
    this.properties.setValue(
      key,
      new Field(key, FieldType.Date, date.toISOString())
    );
  }
  public addTextProperty(
    key: string,
    value: string,
    persist: boolean = true,
    isCustom: boolean = false,
    showOnAutoForm: boolean = false
  ) {
    const definition: FieldDefinition = {
      key,
      englishLabel: isCustom ? key : titleCase(key),
      persist,
      type: "Text",
      isCustom,
      showOnAutoForm
    };
    const f = Field.fromFieldDefinition(definition);
    f.setValueFromString(value);

    if (key === "Sub-Genre") {
      console.log(
        "addTextProperty(Sub-Genre) " +
          JSON.stringify(this.properties.getValue(key))
      );
    }
    this.properties.setValue(key, f);

    // //console.log("setting " + key + " to " + value);
    // const field = new Field(
    //   key,
    //   FieldType.Text,
    //   value,
    //   undefined,
    //   undefined,
    //   undefined,
    //   persist
    // );
    //this.properties.setValue(key, field);

    assert.ok(value === this.properties.getTextField(key).text);
  }
  public setTextProperty(key: string, value: string) {
    //many SayMore 1/2/3.x xml files used a mix of upper and lower case
    //We can read the upper case ones, but then we convert them to lower case initial
    const correctedKey = camelcase(key);
    this.properties.setValue(
      key,
      new Field(correctedKey, FieldType.Text, value)
    );
  }
  public getTextProperty(key: string, ifMissing: string = "MISSING"): string {
    try {
      const p = this.properties.getValueOrThrow(key); //as Field;
      return p.text;
    } catch {
      return ifMissing;
    }
  }

  public getTextField(key: string): Field {
    return this.properties.getValueOrThrow(key) as Field;
  }

  public constructor(
    describedFilePath: string,
    metadataFilePath: string,
    xmlRootName: string,
    fileExtensionForMetadata: string,
    canDelete: boolean
  ) {
    this.canDelete = canDelete;
    this.describedFilePath = describedFilePath;
    this.metadataFilePath = metadataFilePath;
    this.xmlRootName = xmlRootName;
    this.fileExtensionForMetadata = fileExtensionForMetadata;

    // NB: subclasses should call this (as super()), then read in their definitions, then let us finish by calling finishLoading();
  }

  // call this after loading in your definitions
  protected finishLoading() {
    this.addFieldsUsedInternally();
    this.readMetadataFile();
    this.computeProperties(); //enhance: do this on demand, instead of for every file
  }

  // These are fields that are computed and which we don't save, but which show up in the UI.
  private addFieldsUsedInternally() {
    this.addTextProperty("filename", "", false);
    this.setFileNameProperty();
    this.addTextProperty("notes", "");
    const stats = fs.statSync(this.describedFilePath);
    this.addTextProperty("size", filesize(stats.size, { round: 0 }), false);
    this.addDateProperty("modifiedDate", stats.mtime);
    const typePatterns = [
      ["Session", /\.session$/i],
      ["Person", /\.person$/i],
      ["Audio", /\.((mp3)|(wav)|(ogg))$/i],
      ["Video", /\.((mp4))$/i],
      ["ELAN", /\.((eaf))$/i],
      ["Image", /\.(jpg)|(bmp)|(gif)|(png)/i],
      ["Text", /\.(txt)/i]
    ];
    const match = typePatterns.find(t => {
      return !!this.describedFilePath.match(t[1]);
    });
    const typeName = match
      ? (match[0] as string)
      : Path.extname(this.describedFilePath);
    this.addTextProperty("type", typeName, false);
  }

  private loadPropertiesFromXml(propertiesFromXml: any) {
    const keys = Object.keys(propertiesFromXml);

    for (const key of keys) {
      if (key.toLocaleLowerCase() === "contributions") {
        this.loadContributions(propertiesFromXml[key]);
      } else if (key.toLowerCase() === "customfields") {
        //        console.log(JSON.stringify(propertiesFromXml[key]));
        const customKeys = Object.keys(propertiesFromXml[key]);
        for (const customKey of customKeys) {
          // first one is just $":{"type":"xml"}
          if (customKey !== "$") {
            this.loadOnePersistentProperty(
              customKey,
              propertiesFromXml[key][customKey],
              true // isCustom
            );
          }
        }
      } else {
        this.loadOnePersistentProperty(key, propertiesFromXml[key], false);
      }
    }
  }

  private loadOnePersistentProperty(
    key: string,
    value: any,
    isCustom: boolean
  ) {
    // console.log("loadProperties key: " + key);
    // console.log(JSON.stringify(value));
    if (value === undefined) {
      value = "";
    } else if (typeof value === "object") {
      if (
        (value.$ && value.$.type && value.$.type === "string") ||
        value.$.type === "date"
      ) {
        value = value._;
      } else {
        //console.log("Skipping " + key + " which was " + JSON.stringify(value));
        return;
      }
    }

    const textValue: string = value;

    // We want to preserve input and output with SayMore Windows, which at this time has properties with a variety of conventions
    const knownPropertiesWithInterestingCasing = [
      "Location_Country",
      "Location_Region",
      "Location_Continent",
      "Location_Address",
      "Planning_Type",
      "Sub-Genre" /*misspelled*/,
      "Social_Context",
      "Involvement"
    ];

    // todo: need a comment about why we ever change the key (I don't remember at the moment)...
    const fixedKey =
      knownPropertiesWithInterestingCasing.indexOf(key) > -1
        ? key
        : camelcase(key);

    // if it's already defined, let the existing field parse this into whatever structure (e.g. date)
    if (this.properties.containsKey(fixedKey)) {
      const v = this.properties.getValueOrThrow(fixedKey);
      v.setValueFromString(textValue);
      //console.log("11111" + key);
    } else {
      // Note: at least as of SayMore Windows 3.1, its files will have dates with the type "string"
      // So we work around that by looking at the name of the key, to see if it contains the word "date"
      if (key.toLowerCase().indexOf("date") > -1) {
        this.addDatePropertyFromString(fixedKey, textValue);
      } else {
        //console.log("extra" + fixedKey + "=" + value);
        // otherwise treat it as a string
        this.addTextProperty(
          fixedKey,
          textValue,
          true,
          isCustom,
          true /*showOnAutoForm*/
        );
      }
    }
  }

  private loadContributions(contributionsFromXml: any) {
    if (!contributionsFromXml.contributor) {
      return;
    }
    if (Array.isArray(contributionsFromXml.contributor)) {
      for (const c of contributionsFromXml.contributor) {
        this.loadOneContribution(c);
      }
    } else {
      this.loadOneContribution(contributionsFromXml.contributor);
    }
  }
  private loadOneContribution(contributionFromXml: any) {
    const n = new Contribution();
    n.name = contributionFromXml.name;
    n.role = contributionFromXml.role;
    n.date = contributionFromXml.date;
    n.comments = contributionFromXml.comments;
    this.contributions.push(n);
  }

  public computeProperties() {
    switch (this.type) {
      case "Audio":
        if (this.describedFilePath.match(/\.((mp3)|(ogg))$/i)) {
          //TODO: this is killing unrleated unit testing... presumably because the callback happens after the tests are done?
          // musicmetadata(fs.createReadStream(this.path), (err, metadata) => {
          //   if (err) {
          //     console.log("Error:" + err.message);
          //   }
          //   this.addTextProperty(
          //     "duration",
          //     err ? "????" : metadata.duration.toString() // <-- haven't see this work yet. I think we'll give in and ship with ffmpeg eventually
          //   );
          //   // todo bit rate & such, which musicmetadata doesn't give us
          // });
        }
        break;
      case "Image":
        const dimensions = imagesize(this.describedFilePath);
        this.addTextProperty("width", dimensions.width.toString());
        this.addTextProperty("height", dimensions.height.toString());
        break;
    }
  }
  public readMetadataFile() {
    if (fs.existsSync(this.metadataFilePath)) {
      const xml: string = fs.readFileSync(this.metadataFilePath, "utf8");

      let xmlAsObject: any = {};
      xml2js.parseString(
        xml,
        {
          async: false,
          explicitArray: false //this is good for most things, but if there are sometimes 1 and sometime multiple (array), you have to detect the two scenarios
          //explicitArray: true, this also just... gives you a mess
          //explicitChildren: true this makes even simple items have arrays... what a pain
        },
        (err, result) => {
          if (err) {
            throw err;
          }
          xmlAsObject = result;
        }
      );
      // that will have a root with one child, like "Session" or "Meta". Zoom in on that
      // so that we just have the object with its properties.
      let properties = xmlAsObject[Object.keys(xmlAsObject)[0]];
      if (properties === "") {
        //   Review: This happen if it finds, e.g. <Session/>.
        properties = {};
      }
      // else {
      //   properties = properties.$$; // this is needed if xml2js.parstring() has explicitChildren:true
      // }

      //copies from this object (which is just the xml as an object) into this File object
      this.loadPropertiesFromXml(properties);
      //review: this is looking kinda ugly... not sure what I want to do
      // because contributions is only one array at the moment
      this.properties.addContributionArrayProperty(
        "contributions",
        this.contributions
      );
    }

    // It's important to do this *after* all the deserializing, so that we don't count the deserializing as a change
    // and then re-save, which would make every file look as if it was modified today.
    // And we also need to run it even if the meta file companion doesn't exist yet for some file, so that
    // we'll create it if/when some property gets set.
    this.watchForChange = mobx.reaction(
      // Function to check for a change. Mobx looks at its result, and if it is different
      // than the first run, it will call the second function.
      () => {
        return this.getXml();
      },
      // Function fires when a change is detected
      () => this.changed()
    );
  }

  private getXml(): string {
    const root = xmlbuilder.create(this.xmlRootName, {
      version: "1.0",
      encoding: "utf-8"
    });
    this.properties.forEach((k, f: Field) => {
      if (f.persist) {
        if (f.key === "contributions") {
          const contributionsElement = root.element("contributions", {
            type: "xml"
          });
          this.contributions.forEach(contribution => {
            if (contribution.name && contribution.name.trim().length > 0) {
              let tail = contributionsElement.element("contributor");
              if (contribution.name) {
                //console.log("zzzzz:" + contribution.name);
                tail = tail.element("name", contribution.name).up();
              }
              if (contribution.role) {
                tail = tail.element("role", contribution.role).up();
              }
              this.writeDate(tail, "date", contribution.date);
              if (
                contribution.comments &&
                contribution.comments.trim().length > 0
              ) {
                tail = tail.element("comments", contribution.comments).up();
              }
            }
          });
        } else {
          if (!f.definition || !f.definition.isCustom) {
            const t = f.typeAndValueForXml();
            const type = t[0];
            const value = t[1];

            if (type === "date") {
              // console.log(
              //   "date " + f.key + " is a " + type + " of value " + value
              // );
              this.writeDate(root, f.key, value);
            } else {
              assert.ok(
                k.indexOf("date") === -1 || type === "date",
                "SHOULDN'T " + k + " BE A DATE?"
              );
              if (value.length > 0) {
                root.element(k, { type }, value).up();
              }
            }
          }
        }
      }
    });
    const customParent = root.element("CustomFields", {
      type: "xml"
    });
    this.properties.forEach((k, f: Field) => {
      if (f.definition && f.definition.isCustom) {
        const t = f.typeAndValueForXml();
        if (k && k.length > 0 && t[1] && t[1].length > 0) {
          customParent.element(k, { type: t[0] }, t[1]).up();
        }
      }
    });
    customParent.up();

    return root.end({ pretty: true, indent: "  " });
  }

  private writeDate(
    builder: xmlbuilder.XMLElementOrXMLNode,
    key: string,
    dateString: string
  ): xmlbuilder.XMLElementOrXMLNode {
    const ISO_YEAR_MONTH_DATE_DASHES_FORMAT = "YYYY-MM-DD";
    if (dateString) {
      if (moment(dateString).isValid()) {
        const d = moment(dateString);
        return builder
          .element(
            key,
            // As of SayMore Windows 3.1.4, it can't handle a type "date"; it can only read and write a "string",
            // so instead of the more reasonable { type: "date" }, we are using this
            { type: "string" },
            d.format(ISO_YEAR_MONTH_DATE_DASHES_FORMAT)
          )
          .up();
      }
    }
    return builder; // we didn't write anything
  }
  public save() {
    // console.log("SAVING DISABLED");
    // return;

    if (!this.dirty && fs.existsSync(this.metadataFilePath)) {
      //console.log(`skipping save of ${this.metadataFilePath}, not dirty`);
      return;
    }
    console.log(`Saving ${this.metadataFilePath}`);

    const xml = this.getXml();

    if (this.describedFilePath.indexOf("sample data") > -1) {
      // console.log(
      //   "PREVENTING SAVING IN DIRECTORY THAT CONTAINS THE WORDS 'sample data'"
      // );
      console.log("WOULD HAVE SAVED THE FOLLOWING TO " + this.metadataFilePath);
      // console.log(xml);
    } else {
      //console.log("writing:" + xml);
      fs.writeFileSync(this.metadataFilePath, xml);
      this.clearDirty();
    }
  }

  private getUniqueFilePath(intendedPath: string): string {
    let i = 0;
    let path = intendedPath;
    const extension = Path.extname(intendedPath);
    // enhance: there are pathological file names like "foo.mp3.mp3" where this would mess up.
    const pathWithoutExtension = Path.join(
      Path.dirname(intendedPath),
      Path.basename(intendedPath).replace(extension, "")
    );
    while (fs.existsSync(path)) {
      i++;
      path = pathWithoutExtension + " " + i + extension;
    }
    return path;
  }

  // Rename one file on disk and return the new full path.
  // A file is renamed only if it currently contains
  // the folder name. E.g. if we are changing from "jo" to "joe":
  // jo.person  --> joe.person
  // jo_photo.jpg --> joe_photo.jpg
  // group_photo.jpg --> no change
  private internalUpdateNameBasedOnNewFolderName(
    currentFilePath: string,
    newbase: string
  ): string {
    const oldbase = Path.basename(Path.dirname(currentFilePath));
    const oldFilename = Path.basename(currentFilePath);
    if (oldFilename.startsWith(oldbase)) {
      const newFilename = oldFilename.replace(oldbase, newbase);
      let newPath = Path.join(Path.dirname(currentFilePath), newFilename);
      // can't think of a strong scenario for this at the moment,
      // but it makes sure the rename will not fail due to a collision
      newPath = this.getUniqueFilePath(newPath);
      fs.renameSync(currentFilePath, newPath);
      return newPath;
    }
    return currentFilePath;
  }
  private updateFolderOnly(path: string, newFolderName: string): string {
    const filePortion = Path.basename(path);
    const directoryPortion = Path.dirname(path);
    const parentDirectoryPortion = Path.dirname(directoryPortion);
    return Path.join(parentDirectoryPortion, newFolderName, filePortion);
  }
  public isOnlyMetadata(): boolean {
    return this.metadataFilePath === this.describedFilePath;
  }
  // Rename the file and change any internal references to the name.
  // Must be called *before* renaming the parent folder.
  public updateNameBasedOnNewFolderName(newFolderName: string) {
    const hasSeparateMetaDataFile =
      this.metadataFilePath !== this.describedFilePath;
    if (hasSeparateMetaDataFile && fs.existsSync(this.metadataFilePath)) {
      this.metadataFilePath = this.internalUpdateNameBasedOnNewFolderName(
        this.metadataFilePath,
        newFolderName
      );
      this.metadataFilePath = this.updateFolderOnly(
        this.metadataFilePath,
        newFolderName
      );
    }
    this.describedFilePath = this.internalUpdateNameBasedOnNewFolderName(
      this.describedFilePath,
      newFolderName
    );
    this.describedFilePath = this.updateFolderOnly(
      this.describedFilePath,
      newFolderName
    );
    if (!hasSeparateMetaDataFile) {
      this.metadataFilePath = this.describedFilePath;
    }
    this.setFileNameProperty();
  }

  private setFileNameProperty() {
    this.properties.setText("filename", Path.basename(this.describedFilePath));
  }
  /* ----------- Change Detection -----------
    Enhance: move to its own class
  */

  private watchForChange: mobx.IReactionDisposer;

  //does this need to be saved?
  private dirty: boolean;
  public isDirty(): boolean {
    return this.dirty;
  }

  // This is/was called whenever a UI shows that has user-changable things.
  // I did this before setting up the mobx.reaction system to actually notice
  // when something changes. Leaving it around, made to do nothing, until I gain
  // confidence in the new system.
  public couldPossiblyBecomeDirty() {
    if (this.dirty) {
      //console.log(`Already dirty: ${this.metadataFilePath}`);
    } else {
      //console.log(`Considered dirty: ${this.metadataFilePath}`);
    }
    //this.dirty = true;
  }
  private clearDirty() {
    this.dirty = false;
    console.log("dirty cleared " + this.metadataFilePath);
  }

  private changed() {
    if (this.dirty) {
      //console.log("changed() but already dirty " + this.metadataFilePath);
    } else {
      this.dirty = true;
      //console.log(`Changed and now dirty: ${this.metadataFilePath}`);
    }
  }
  public wasChangeThatMobxDoesNotNotice() {
    this.changed();
  }

  public getIconName(): string {
    const type = this.getTextProperty("type", "unknowntype");
    return locate(`assets/file-icons/${type}.png`);
  }

  // We're defining "core name" to be the file name (no directory) minus the extension
  private getCoreName(): string {
    return Path.basename(this.describedFilePath).replace(
      Path.extname(this.describedFilePath),
      ""
    );
  }
  /**
   * Return core name of the file modified to indicate the given role
   *
   * @param roleName e.g. "consent"
   */
  private getCoreNameWithRole(roleName: string): string {
    // TODO: this needs to become a lot more sophisticated
    return this.getCoreName() + "_" + roleName;
  }
  private tryToRenameToFunction(roleName: string): boolean {
    if (this.tryToRenameBothFiles(this.getCoreNameWithRole(roleName))) {
      return true;
    }
    return false;
  }

  private tryToRenameBothFiles(newCoreName: string): boolean {
    assert(
      this.metadataFilePath !== this.describedFilePath,
      "this method is not for renaming the person or session files"
    );

    this.save();
    const newDescribedFilePath = Path.join(
      Path.dirname(this.describedFilePath),
      newCoreName + Path.extname(this.describedFilePath)
    );

    const newMetadataFilePath = newDescribedFilePath + ".meta";

    if (
      fs.existsSync(newDescribedFilePath) ||
      fs.existsSync(newMetadataFilePath)
    ) {
      console.error(
        "Cannot rename: one of the files that would result from the rename already exists."
      );
      return false;
    }
    try {
      fs.renameSync(this.metadataFilePath, newMetadataFilePath);
    } catch (err) {
      return false;
    }
    try {
      fs.renameSync(this.describedFilePath, newDescribedFilePath);
    } catch (err) {
      // oh my. We failed to rename the described file. Undo the rename of the metadata file.
      try {
        fs.renameSync(newMetadataFilePath, this.metadataFilePath);
      } catch (err) {
        return false;
      }
      return false;
    }
    this.describedFilePath = newDescribedFilePath;
    this.metadataFilePath = newMetadataFilePath;
    this.setFileNameProperty();
    return true;
  }

  public isLabeledAsConsent(): boolean {
    return this.describedFilePath.indexOf("Consent") > -1;
  }
  public canRenameForConsent(): boolean {
    return !(this.isLabeledAsConsent() || this.isOnlyMetadata());
  }
  public renameForConsent() {
    assert(!this.isOnlyMetadata());
    assert(!this.isLabeledAsConsent());
    if (!this.tryToRenameToFunction("Consent")) {
      window.alert("Sorry, something prevented the rename");
    }
    console.log("renameForConsent " + this.describedFilePath);
    //this.properties.setValue("hasConsent", true);
  }
}

export class OtherFile extends File {
  constructor(path: string) {
    super(path, path + ".meta", "Meta", ".meta", true);
    this.finishLoading();
  }
}
