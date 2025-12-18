# Gym&Gain
Welcome to **Gym&Gain**! This is a dynamic full-stack fitness app built to help users crush their workout goals and book classes. I built this project to master Node.js, Express, and complex state management without relying on heavy frontend frameworks.

---

## Table of Contents

- [Features](#-features)
    - [Membership Tiers & Permissions](#1-membership-tiers--tokens)
    - [The Routine Creator](#2-the-routine-creator-it-remembers-everything)
    - [Social Dashboard](#3-social-dashboard-)
- [Technology Stack](#-tech-stack-what-i-used)
- [How to Run It](#-how-to-run-it)
- [Deployment ](#-running-on-university-intranet)
- [Project Structure](#-project-structure)

---

##  What is this?

Gym&Gain isn't just a booking system; it's a complete fitness application. It lets users explore a weekly schedule, manage their "Tokens" to book classes, and build their own custom workout routines using a real exercise API.

I focused heavily on **User Experience (UX)**—specifically making sure the app feels fast and remembers your progress, even when the server creates a new page.

---

##  Features

### 1. Membership Tiers & Tokens
I implemented a gamified system where different users get different perks:
*   **Basic**: Good for starters. Can book standard classes.
*   **Silver & Gold**: For the pros. Unlocks exclusive high-intensity classes!
*   **Tokens**: Instead of just clicking "Book", users spend tokens. This adds a layer of logic to check balances and deduct costs before confirming a spot.

**User Permissions:**
*   **Guest**: Can look but can't interact (View Schedule and About views only).
*   **Member**: Can Book, Create Routines, and view the Social Feed.

### 2. The Routine Creator (It remembers everything!)
This is the most technically complex part of the app. It connects to the **WGER API** to search thousands of exercises. 
*   **Smart Persistence**: I hated when forms reset after a search, so I built a system that remembers your **Search Terms**, **Input Text**, and even your **Scroll Position** when you add an exercise. It feels like a Single Page App (SPA), but it's pure server-side rendering!

### 3. Social Dashboard 
Fitness is better together. Registered members can see a **Live Feed** of what classes others are booking. It helps build a sense of community (and friendly competition).

---

## Tech Stack (What I used)

*   **Node.js & Express**: For a robust backend API.
*   **MySQL**: Relational database to link Users, Bookings, and Schedules.
*   **EJS**: Templating engine (because sometimes simple HTML is best).
*   **Vanilla CSS**: No Bootstrap, no Tailwind. I wrote the styles from scratch to learn responsive design properly.
*   **WGER API**: External API integration for exercise data.

---

## How to Run It

### Prerequisites
You'll need **Node.js** and a local **MySQL** server running.

### 1. Clone & Install
```bash
git clone https://github.com/BBexe/10_health_33755196
cd 10_health_33755196
npm install
```

### 2. Set up the Database
Log into your MySQL workbench or terminal and run the scripts:
1.  Run `create_db.sql` (Creates the tables).
2.  Run `insert_test_data.sql` (Adds some dummy users and classes so it's not empty).

### 3. Configure Env Variables
`.env` in the root folder with the following configuration (as per assignment spec):

```env
HEALTH_HOST=localhost
HEALTH_USER=health_app
HEALTH_PASSWORD=qwertyuiop
HEALTH_DATABASE=health
HEALTH_BASE_PATH=http://localhost:8000
SESSION_SECRET=your_secret_key
```

*Note: The `HEALTH_BASE_PATH` is used for absolute URL redirection. For deployment, update this path accordingly (`https://doc.gold.ac.uk/usr/424`).*

### 4. Start!
```bash
npm start
```
Go to `http://localhost:8000`!

---

## Deployment Configuration

I centralized all my routing logic.
*   **Deployment**: Just set `HEALTH_BASE_PATH=https://doc.gold.ac.uk/usr/424` in your `.env`.
*   The app automatically detects this path and adjusts every link and redirect so nothing breaks.

---

## Project Structure

*   **/routes**: Where the logic lives (Users, Schedule, Routines).
*   **/views**: The UI templates (EJS).
*   **/middleware**: Checks if you're logged in (Auth) and handles the URL fixes.
*   **/public**: CSS and Client-side scripts.
