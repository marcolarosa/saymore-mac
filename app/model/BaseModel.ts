import { observable } from "mobx";
import * as fs from "fs";
import * as Path from "path";
import FileDescriptor from "./ComponentFile";

/* This whole class is a hack, to work with a typescript object in a simple property-name way.
   We use this for peristence and form-filling (without boilerplate code for each field). */
export class FormObject {
  public setString(key: string, value: string) {
    this[key] = value;
  }
  public getString(key: string): string {
    return this[key];
  }
  [key: string]: string | File[] | any; // not sure about this. allows setting property by name

  public loadFromObject(data: any) {
    // see https://stackoverflow.com/questions/22875636/how-do-i-cast-a-json-object-to-a-typescript-class
    // this is lame because it ignores any property that does not have an initializer
    const keys = Object.keys(this);

    for (const key of keys) {
      if (data.hasOwnProperty(key)) {
        this[key] = data[key];
      }
    }
  }
}

export class DirectoryObject extends FormObject {
  public path: string = "";
  public directory: string = "";
  @observable public files: FileDescriptor[] = [];
  @observable public selectedFile: FileDescriptor;
}