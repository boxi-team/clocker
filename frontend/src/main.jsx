import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { authService } from './services/authService';

authService.checkSession();

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
);