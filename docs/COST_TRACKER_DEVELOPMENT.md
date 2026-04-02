# Cost Tracker Development

## Current Progress
- The **Agent Detail Drawer** has been successfully implemented, allowing users to view agent statuses and recent activity.
- The **Activity Timeline** component is integrated into the dashboard, displaying real-time agent events.
- The **Quick Command** component enables sending direct messages to agents (Mildred/Dev/Janet).
- Gateway connection is confirmed with live data updates, although minor UI cleanup is required (removal of the "Future" label and fixing the "Realtime disconnected" badge).

## Key Decisions Made
- The decision to replace the old Claire agent with Janet has been finalized, and that change is live in the workflow.
- The frontend now reflects real-time agent states and updated interactions.

## Important Context & Constraints
- The application is built in React with TypeScript, utilizing Vite for development.
- WebSocket is used for real-time event handling between the frontend and the OpenClaw backend.
- Cost metrics (spending on tokens, etc.) need to be sourced from the existing backend APIs.

## What Remains to be Done
1. **Implement the Cost Tracker**:
   - Create a new component for displaying estimated and actual costs from API calls.
   - Integrate the fetching of cost summary into the main App component.
   - Ensure that real-time updates are reflected in the Cost Tracker.
2. **UI Cleanup**:
   - Fix the duplicate "Future" agent in the UI.
   - Resolve the "Realtime disconnected" issue with the WebSocket.
3. **Testing and Validation**:
   - Ensure all new functionalities (Cost Tracker, Agent Detail Drawer) are thoroughly tested with existing data.