import { Dictionary } from "typescript-collections";
import * as assert from "assert";
import { Field, FieldType, FieldDefinition, HasConsentField } from "./Field";
import { Contribution } from "../file/File";
import { Person } from "../Project/Person/Person";

export class FieldSet extends Dictionary<string, Field> {
  public setText(key: string, value: string) {
    const f = this.getValueOrThrow(key);
    assert.ok(f, `setText(${key}) assumes the value is already there.`);
    f.setValueFromString(value);
  }

  // the dictionary implementation has a signature that includes undefined, which makes
  // it *really* annoying to use, as TS will force you to check the return value every time
  public getValueOrThrow(key: string): Field {
    const f = super.getValue(key);
    if (f === undefined) {
      throw Error("This FieldSet has no value with key: " + key);
    } else {
      return f;
    }
  }

  public getFieldDefinition(key: string): FieldDefinition {
    const f = this.getValueOrThrow(key) as Field;
    return f.definition;
  }
  public getTextStringOrEmpty(key: string): string {
    try {
      const s = this.getValueOrThrow(key) as Field;
      return s.text;
    } catch {
      return "";
    }
  }
  public getTextField(key: string): Field {
    return this.getValueOrThrow(key) as Field;
  }
  public getDateField(key: string): Field {
    return this.getValueOrThrow(key) as Field;
  }
  public addDateProperty(key: string, date: Date) {
    this.checkType(key, date);
    this.setValue(key, new Field(key, FieldType.Date, date.toISOString()));
  }
  public addHasConsentProperty(person: Person) {
    this.setValue("hasConsent", new HasConsentField(person));
  }
  public manditoryTextProperty(key: string, value: string) {
    if (!this.containsKey(key)) {
      this.setValue(key, new Field(key, FieldType.Text, value));
    }
  }
  // public manditoryField(field: Field) {
  //   if (this.containsKey(field.key)) {
  //     const existing = this.getValue(field.key);
  //     // a fuller version of this could be made to migrate the old data into what we expect now
  //     field.setValueFromString(existing)
  //   }
  //   else {
  //     this.setValue(field.key, field);
  //   }
  // }
  public addTextProperty(key: string, value: string) {
    this.setValue(key, new Field(key, FieldType.Text, value));
  }
  // public addCustomProperty(key: string, value: string) {
  //   const definition: IFieldDefinition = {
  //     key,
  //     englishLabel: key, // key is the englishLabel
  //     //default?: string;
  //     persist: true,
  //     type: "Text",
  //     //form,
  //     //cssClass,
  //     //choices,
  //     //complexChoices: [],
  //     order: 0,
  //     //order: number;
  //     //imdiRange?: string;
  //     //imdiIsClosedVocabulary?: boolean;
  //     isCustom: true
  //   };
  //   const f = Field.fromFieldDefinition(definition);
  //   f.setValueFromString(value);
  //   this.setValue(key, f);
  // }

  public addCustomProperty(f: Field) {
    this.setValue(f.key, f);
  }
  public addContributionArrayProperty(key: string, value: Contribution[]): any {
    const f = new Field(key, FieldType.Contributions, "unused");
    f.contributorsArray = value;
    this.setValue(key, f);
  }
  private checkType(key: string, value: any) {
    if (this.containsKey(key)) {
      const a = typeof this.getValueOrThrow(key);
      const b = typeof value;
      assert.ok(a === b, `Cannot change type of ${key} from ${a} to ${b}`);
    }
  }
  // users are allow to rename a custom field.
  public changeKeyOfCustomField(field: Field, newKey: string) {
    assert(
      this.containsKey(field.key),
      "Could not find existing field with the old key in the properties dictionary"
    );
    this.remove(field.key);
    field.key = newKey;
    this.setValue(field.key, field);
  }
}
