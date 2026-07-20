# 🎮 AI Pixel Secretary

> **A Personal AI Health Agent for Milestone Tracker**
>
> Pixel Secretary is a **new standalone page** inside Milestone Tracker.
> It is **not** an extension of existing Food, Weight, or Exercise tabs.
> Instead, it is a central AI workspace where users interact naturally
> with their personal AI assistant.

------------------------------------------------------------------------

# Vision

Pixel Secretary transforms Milestone Tracker from a traditional tracking
application into an intelligent health companion.

Users should not need to navigate multiple pages or manually fill out
forms.

Instead, they simply talk to Pixel.

Pixel understands the request, reads relevant application data, plans
the required actions, executes approved functions, and explains what it
is doing.

------------------------------------------------------------------------

# Product Principles

-   More than a chatbot.
-   A personal AI health agent.
-   Action-oriented instead of conversation-oriented.
-   Transparent about every action it performs.
-   Safe by design through function calling and user confirmation.

------------------------------------------------------------------------

# Dedicated AI Page

Pixel Secretary is implemented as **its own page**.

It should **not** merge with:

-   Food Page
-   Weight Page
-   Exercise Page
-   Dashboard
-   Reports

Those pages remain focused on manual management.

Pixel Secretary becomes the intelligent entry point capable of
interacting with every feature across the application.

------------------------------------------------------------------------

# User Experience

Examples:

## Food Logging

User:

> Today I ate chicken rice and a Thai milk tea.

Pixel:

-   Analyze the meal
-   Estimate calories
-   Estimate protein
-   Ask follow-up questions if needed
-   Save meal
-   Update dashboard
-   Explain the result

------------------------------------------------------------------------

## Weight

User:

> Today's weight is 70.4 kg.

Pixel:

-   Save weight
-   Refresh charts
-   Compare with previous entries
-   Explain trends

------------------------------------------------------------------------

## Analytics

User:

> Why hasn't my weight decreased?

Pixel may analyze:

-   Weight history
-   Meals
-   Calories
-   Protein
-   Exercise
-   Goals

Then provide a personalized explanation.

------------------------------------------------------------------------

# Capabilities

## Read

Pixel can read application data such as:

-   Meals
-   Weight history
-   Exercise history
-   Daily nutrition
-   Goals
-   Progress
-   Achievements

## Write

Pixel can:

-   Add meals
-   Update meals
-   Delete meals
-   Add exercise
-   Update weight
-   Update goals
-   Generate reports

All write operations must use application functions.

------------------------------------------------------------------------

# Architecture

User

↓

Pixel Secretary (UI + Personality)

↓

AI Orchestrator

-   Intent Detection
-   Planning
-   Memory
-   Tool Selection
-   Validation

↓

AI Provider

-   Gemini
-   GPT
-   Claude
-   DeepSeek
-   Qwen

↓

Application Functions

↓

Firestore

------------------------------------------------------------------------

# Function Calling

The AI never writes directly to the database.

Every operation must go through application functions.

Examples:

-   addMeal()
-   updateMeal()
-   deleteMeal()
-   updateWeight()
-   addExercise()
-   searchFood()
-   generateReport()
-   navigate()

------------------------------------------------------------------------

# Activity Timeline

Pixel continuously displays its workflow.

Example:

-   Reading user request...
-   Searching nutrition database...
-   Calculating calories...
-   Saving meal...
-   Updating dashboard...
-   Completed.

------------------------------------------------------------------------

# Pixel States

-   Idle
-   Thinking
-   Reading
-   Searching
-   Calculating
-   Analyzing
-   Saving
-   Waiting for Confirmation
-   Completed
-   Error

------------------------------------------------------------------------

# Permissions

Automatic:

-   Read
-   Search
-   Analyze
-   Navigate

Require confirmation:

-   Create
-   Update
-   Delete
-   Replace

------------------------------------------------------------------------

# Future Features

-   Voice Mode
-   Daily Brief
-   Smart Coaching
-   Long-term Memory
-   Achievement Reactions
-   Multi-model AI Support

------------------------------------------------------------------------

# MVP

Version 1 includes:

-   Chat interface
-   Read user data
-   Add meal
-   Update weight
-   Add exercise
-   Basic analytics
-   Navigation
-   Function calling
-   Activity timeline

------------------------------------------------------------------------

# Long-term Goal

Pixel Secretary becomes the primary way users interact with Milestone
Tracker.

Instead of opening multiple pages and manually entering information,
users simply communicate with Pixel.

Pixel understands, plans, acts, and explains every step while keeping
the user in control.
