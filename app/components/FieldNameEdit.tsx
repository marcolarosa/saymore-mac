import * as React from "react";
import * as mobx from "mobx-react";
import { Field } from "../model/field/Field";
const titleCase = require("title-case");

export interface IProps {
  field: Field;
  onFieldNameChanged?: () => void;
}
interface IState {
  invalid: boolean;
}
@mobx.observer
export default class FieldNameEdit extends React.Component<
  IProps & React.HTMLAttributes<HTMLDivElement>, // the React.HTMLAttributes<HTMLDivElement> allows the use of "className=" on these fields
  IState
> {
  constructor(props: IProps) {
    super(props);
    this.state = { invalid: false };
  }

  private validate(label: string): boolean {
    return (
      //label.trim().length > 0 &&
      label.indexOf("<") === -1 && label.indexOf(">") === -1
    );
  }
  private onChange(event: React.FormEvent<HTMLTextAreaElement>, field: Field) {
    // note, we don't want to change the key, we leave that up to the parent component
    field.englishLabel = this.processLabel(event.currentTarget.value);
    this.setState({ invalid: false });
  }
  private processLabel(label: string): string {
    // replace spaces with underscore
    return label.trim().replace(/\s/g, "_");
  }
  public render() {
    const classname = this.state.invalid ? "invalid" : "";
    // console.log(
    //   `rendering ${this.props.field.key} / ${this.props.field.englishLabel} / ${
    //     this.props.field.text
    //   }`
    // );
    return (
      <textarea
        className={classname}
        name={this.props.field.key} //what does this do? Maybe accessibility?
        value={this.props.field.englishLabel}
        onChange={event => this.onChange(event, this.props.field)}
        onBlur={(event: React.FocusEvent<HTMLTextAreaElement>) => {
          const newLabel = this.processLabel(event.currentTarget.value);
          if (!this.validate(newLabel)) {
            event.preventDefault();
            const textarea = event.currentTarget;
            window.setTimeout(() => {
              textarea.focus();
              this.setState({ invalid: true });
            });
          }
          // if it's a valid field name
          else {
            if (
              this.props.onFieldNameChanged &&
              this.props.field.key !== newLabel
              // && newLabel.length > 0
            ) {
              this.props.onFieldNameChanged();
            }
          }
        }}
      />
    );
  }
}
