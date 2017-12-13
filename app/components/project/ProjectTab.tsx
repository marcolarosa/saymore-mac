import * as React from "react";
import { observer } from "mobx-react";
import { Project } from "../../model/Project";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import ProjectAbout from "./ProjectAbout";

interface IProps {
  project: Project;
}

@observer
export class ProjectTab extends React.Component<IProps> {
  public render() {
    return (
      <Tabs className={"project"}>
        <TabList>
          <Tab>About This Project</Tab>
          <Tab>Access Protocol</Tab>
        </TabList>
        <TabPanel>
          <ProjectAbout project={this.props.project} />
        </TabPanel>
        <TabPanel>
          <h1>Access Protocol</h1>
        </TabPanel>
      </Tabs>
    );
  }
}