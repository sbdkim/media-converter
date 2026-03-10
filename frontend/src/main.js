import './style.css';
import { initApp } from './app.js';

if (document.querySelector('#app')) {
  initApp();
}

export { initApp };
