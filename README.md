# COT 5930 Project 1

Student: Chris Logan
Email: loganc2023@fau.edu

GCP Project Name: projectYY
GCP Project ID: projectYY (link to google cloud console to your project page)
** Make sure you have added the instructor and TAs to the GCP project with “Project Viewer”
role
Cloud Run Service name: app123
App URL: http://abc/app1/xyz

Introduction
Describe what the project is all about, its goals and objectives. High level definition of the
features implemented.

Architecture
<diagram showing all high level components>
Describe how the project was planned and implemented, showing all the components that are
part of the project (some examples: vm, firewall, databases, storage, end users, etc)
For each component listed above, go in more details as to why they are important for your
architecture.

Implementation
For each component, list details on the code and configurations done in order to achieve the
project’s goals.
Example, for the application, discuss the code by explaining all the dependencies and structure
of the code, and how that relates to the features of the application.
Things to consider: app location on the server, how to start, port number utilized, HTTP
requests, HTML created, location where files are stored, firewall rules, and any other
configuration that you’ve made.

Pros and Cons
Discuss what are the problems of this solution, assuming it needs to handle multiple users and
scale as discussed in class.
Discuss what are the advantages of this solution as implemented in this project.

Problems encountered and Solutions
In case you ran into issues building, testing or deploying your project, describe the challenges
faced and how you solved them.

Application instructions
Describe how to use the application step by step for every feature implemented. Add
screenshots if you wish. This is what could become your end user’s manual for the application.

Lessons learned
What did you learn in the process of working on this project?

Appendix
Copy and paste any and all code and configs you created for your project.
Examples, .py, .html, requirements.txt, Procfile/Dockerfile, .js

Instructions
TAs and the Instructor must be granted access to your cloud projects and source
for grading.
Project I
The objective of this first project will be focused on options for leveraging spoken
language as an interface to computers..
You will create a simple web application in python to record from the user’s microphone
and upload the recording to the server. And, receive a text input and generate audio
from the user’s input that can be listened to in the browser. Your python application
must:
- present a html to the user with options to record and listen to the audio files
- have a text input field and use the text to generate audio by leveraging Google’s text to
speech API.
- take the uploaded recording and generate a text transcript by leveraging Google’s
speech to text API
- recommended (but optional) - your app should be deployed to cloud run and be
available in the cloud
Provide a report of your application, architecture, code and design decisions, with a
focus on what you learned.
