import React from "react"
import ReactDOM from "react-dom/client"
import ErrorWindow from "./error-window"
import "./error.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorWindow />
  </React.StrictMode>
)
