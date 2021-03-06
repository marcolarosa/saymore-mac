import * as React from "react";
import { render } from "react-dom";
import { AppContainer } from "react-hot-loader";
import Root from "./containers/Root";
import { remote } from "electron";

import "./app.global.scss";

document.body.setAttribute("class", remote.process.platform);
render(
  <AppContainer>
    <Root />
  </AppContainer>,
  document.getElementById("root")
);

if ((module as any).hot) {
  (module as any).hot.accept("./containers/Root", () => {
    const NextRoot = require("./containers/Root").default;
    render(
      <AppContainer>
        <NextRoot />
      </AppContainer>,
      document.getElementById("root")
    );
  });
}

// const base = document.createElement("base");
// console.log("Setting base to " + locate("app"));
// base.setAttribute("href", locate("app"));
// document.getElementsByTagName("head")[0].appendChild(base);
