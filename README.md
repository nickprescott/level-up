## About
This app allows you to track your skill and habit development while also giving you an additional sense of accomplishment and progression.

All data is stored locally. There's no centralized server or tracking.

## Getting Started

### Installation
The app runs locally and does not require an internet connection.
On your phone:
1. Navigate to: [https://nickprescott.github.io/level-up/](https://nickprescott.github.io/level-up/)
1. In your browser menu, select Add to Home Screen

Opening the app opens a browser window for Level Up.

### Populating Skills
In order to start accruing XP, you should add skills that you would like to develop under the Manage section.
Link a skill to one or more of the overarching Categories: Body, Mind, Heart

### Adding activities
Now that you have some skills defined, you can either pre-populate activities that you know you will be doing in the future, or you can skip this and just log the activities as they occur, which will then allow you to save them as reoccurring activities for easier addition in the future.

## Updating app versions
Updating the app version will attempt to run any data migrations necessary. This should mean that you won't lose data when updating your app version.

## Testing
If you have cloned or forked this repo and working on it locally, you can easily test it by setting up a local server. This avoids all of the CORS issues.

Navigate to the application directory and run:
```
python -m http.server 8080
```
Now you can open a browser and navigate to localhost:8080 which will bring up your version of the app

## Current Limitations
- Clearing your local storage will remove all of your data with no option to recover
- No bulk data creation