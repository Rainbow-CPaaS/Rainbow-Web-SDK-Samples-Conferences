# Rainbow-Web-SDK-Samples-Conferences

This project is build following the starting guides available in on the public Rainbow Developpers website (https://developers.openrainbow.com/)

The idea is to have a quick starting app written in TypeScript (no framework) to show some basic implementations of the APIs related to bubbles and the Bubble Conference management that are avaialbe in the SDK Web (available on npm, "rainbow-web-sdk").

**SDK WEB VERSION 5.0.37-sts AND LATER**

I strongly advice you to use any modern framework for your application, as the code will be 3x easier to write and maintain

But for the sake of the demo and to be framework-free, the code is entarily written in TS with basic HTML/CSS; This application is probably not bug free, but it will give some general directions. I've taken some shortcuts in order to avoid having too complex code, so please read the comments in the code to see where we need to have better management to avoid issues (it's mostly related to checking capabilites and error management, so nothing too complicated but it should be done correctly as to give users a useful feedback, or simply not propose actions when we know they're not allowed).

To build & start the project, you'll need to a dev IDE of your choice, clone the project; install the prerequis described on the starting guides for SDK Web (node, rollup, etc) and then do: (with node at least 18+)

npm i npm run build npm run serve

IF you have issues related to roll-out, install it globally npm install rollup --global

And re-do the actions.

Now you've the project available on your localhost.

In order to know how to create your test app and obtain the application ID, please refer to the public website of Rainbow Developpers

What you will find in this Sample app:

Simple login page
Search for Bubbles
Start or join conference in a bubble
Manage a new conference started in a bubble (from someone else)
Simple conf actions, like mute / unmute and add/remove video;
Basically a simple conference app (with focus on audio);

NOTE: In this version, the media management (video/sharing) is quite simple, there will be further updates on that part.