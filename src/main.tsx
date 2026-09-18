import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './context/SettingsContext';
import { ProjectProvider } from './context/ProjectContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </SettingsProvider>
  </React.StrictMode>
);
