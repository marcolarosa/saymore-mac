import { Folder } from "../../Folder";
import { File } from "../../file/File";
import * as Path from "path";
const knownFieldDefinitions = require("../../field/fields.json");
import * as fs from "fs-extra";
import { FolderMetadataFile } from "../../file/FolderMetaDataFile";

export class Person extends Folder {
  public get metadataFileExtensionWithDot(): string {
    return ".person";
  }

  private get mugshotFile(): File | undefined {
    return this.files.find(f => {
      return f.describedFilePath.indexOf("_Photo.") > -1;
    });
  }

  public get mugshotPath(): string {
    const m = this.mugshotFile;
    return m ? m.describedFilePath : "";
  }

  /* Used when the user gives us a mugshot, either the first one or replacement one */
  public set mugshotPath(path: string) {
    console.log("photopath " + path);

    const f = this.mugshotFile;
    if (f) {
      fs.removeSync(f.describedFilePath);
      this.files.splice(this.files.indexOf(f), 1); //remove that one
    }

    const renamedPhotoPath = this.filePrefix + "_Photo" + Path.extname(path);
    fs.copySync(path, renamedPhotoPath);
    this.addOneFile(renamedPhotoPath);
  }

  public get displayName(): string {
    const code = this.properties.getTextStringOrEmpty("code").trim();
    return code && code.length > 0
      ? code
      : this.properties.getTextStringOrEmpty("name");
  }

  public constructor(directory: string, metadataFile: File, files: File[]) {
    super(directory, metadataFile, files);
    this.properties.setText("name", Path.basename(directory));
    this.properties.addHasConsentProperty(this);
    this.safeFileNameBase = this.properties.getTextStringOrEmpty("name");
    this.properties.getValueOrThrow("name").textHolder.map.intercept(change => {
      // a problem with this is that it's going going get called for every keystroke

      return change;
    });
    this.knownFields = knownFieldDefinitions.person; // for csv export
  }
  public static fromDirectory(directory: string): Person {
    const metadataFile = new PersonMetadataFile(directory);
    const files = this.loadChildFiles(directory, metadataFile);
    return new Person(directory, metadataFile, files);
  }
  public static saveFolderMetaData() {
    //console.log("saving " + person.getString("title"));
    //fs.writeFileSync(person.path + ".test", JSON.stringify(person), "utf8");
  }

  // override
  protected fieldContentThatControlsFolderName(): string {
    return this.properties.getTextStringOrEmpty("name").trim();
  }
}
export class PersonMetadataFile extends FolderMetadataFile {
  constructor(directory: string) {
    super(directory, "Person", ".person", knownFieldDefinitions.person);
  }
}
