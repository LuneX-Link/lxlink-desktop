import React from "react"
import ReactDOM from "react-dom/client"
import Splash from "./app"

const Root = () => {
  return (
    <Splash />
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
