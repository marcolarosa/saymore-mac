import * as fs from "fs";
import * as Path from "path";
import { Field, FieldDefinition } from "../field/Field";
import { File } from "./File";

// project, sessions, and person folders have a single metadata file describing their contents, and this ends
// in a special extension (.sprj, .session, .person)
export class FolderMetadataFile extends File {
  constructor(
    directory: string,
    xmlRootName: string,
    fileExtensionForMetadata: string,
    rawKnownFieldsFromJson: FieldDefinition[]
  ) {
    const name = Path.basename(directory);
    //if the metadata file doesn't yet exist, just make an empty one.
    const metadataPath = Path.join(directory, name + fileExtensionForMetadata);
    if (!fs.existsSync(metadataPath)) {
      fs.writeFileSync(metadataPath, `<${xmlRootName}/>`);
    }
    super(
      metadataPath,
      metadataPath,
      xmlRootName,
      fileExtensionForMetadata,
      false
    );

    this.readDefinitionsFromJson(rawKnownFieldsFromJson);

    this.finishLoading();
  }

  private readDefinitionsFromJson(rawKnownFieldsFromJson: FieldDefinition[]) {
    const knownFields: FieldDefinition[] = rawKnownFieldsFromJson.map(f => {
      return new FieldDefinition(f);
    });
    // load the file containing metadata about this folder with
    // empty fields from the fields.json file
    knownFields.forEach((f: FieldDefinition, i: number) => {
      f.order = i;
      const field = Field.fromFieldDefinition(f);
      this.properties.setValue(field.key, field);
      //console.log("Setting prop from fields.json: " + field.key);
    });
  }
}
