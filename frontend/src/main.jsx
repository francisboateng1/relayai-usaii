if (typeof global === 'undefined') {
  window.global = window;
}
if (typeof process === 'undefined') {
  window.process = { env: {} };
}


import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // If you don't have this file yet, you can create an empty index.css next to it

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)