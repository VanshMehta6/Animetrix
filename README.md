# 🎬 Animetrix – Real‑time Anime Discovery Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Data](https://img.shields.io/badge/Data-Jikan_API-blue)](https://jikan.moe)
[![Made with](https://img.shields.io/badge/Made%20with-Vanilla_JS-orange)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

**Animetrix** is a modern, fully responsive web application that fetches **live anime data** directly from [MyAnimeList](https://myanimelist.net) via the official [Jikan API](https://jikan.moe).  
No fake or hardcoded information – every title, poster, synopsis, rating, episode count, status, season, and trailer is retrieved in real time.

🔗 **Live Demo:** [animetrix.vercel.app](https://animetrix.vercel.app) *(replace with your own URL after deployment)*

---

## ✨ Features

- **Real‑time anime data** – 25,000+ titles from MyAnimeList  
- **Dedicated search page** – results appear on a separate page, not mixed with other sections  
- **Advanced filtering** – by genre, status (airing / completed / upcoming), rating, year  
- **Multiple sorting options** – highest rated, newest first, oldest first, most popular, most episodes  
- **Pagination & “Load More”** – infinite‑scroll style for library and search results  
- **Rich modal** – embedded trailer (when available), Japanese & English titles, season info, MyAnimeList link  
- **Light / Dark mode** – persists across pages  
- **Fully responsive** – works flawlessly on mobile, tablet, and desktop  
- **Glassmorphism UI** – modern, animated, with cursor glow and skeleton loaders  

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Structure & semantics |
| CSS3 | Styling, Grid/Flexbox, glassmorphism, animations |
| JavaScript (Vanilla) | All interactivity, API calls, state management |
| [Jikan API v4](https://jikan.moe) | Real‑time anime metadata from MyAnimeList |
| Font Awesome 6 | Icons |
| Google Fonts (Inter) | Typography |

No frameworks, no build step – pure web standards.

---

## 📁 Project Structure
animetrix/
├── home.html # Main HTML (all pages, modal, navbar)
├── style.css # All styles, animations, responsive rules
├── script.js # Full application logic (API wrapper, state, UI)
├── README.md # This file
└── .gitignore # Files/folders to exclude from version control

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (to fetch live API data)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/animetrix.git
   cd animetrix

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (to fetch live API data)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/animetrix.git
   cd animetrix

2. Open the application

Simply open index.html in your browser

Or use a local server (e.g., npx serve . or VS Code Live Server)

3. No API key required – the Jikan API is open and free.

🔧 Configuration
All API endpoints and caching parameters are defined inside script.js (inside the JikanAPI IIFE). You can adjust:

CACHE_TTL – how long to keep API responses (default 10 minutes)

minInterval – request throttling (default 1 second, respects Jikan's rate limit)

No other configuration is needed.

📄 License
This project is licensed under the MIT License – see the LICENSE file for details.
You are free to use, modify, and distribute it for personal or commercial purposes, provided you include the original copyright notice.

🙏 Acknowledgements
Jikan API – for providing free, accurate MyAnimeList data

MyAnimeList – the ultimate anime database

Font Awesome & Google Fonts – for beautiful icons and typography

📬 Contact
For questions, suggestions, or contributions, please open an issue on GitHub or contact the maintainer at your-email@example.com.

Made with ❤️ by Vansh for anime fans worldwide.