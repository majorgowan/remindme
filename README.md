## Remind me!!

A simple web-based reminder application

- enter reminders using natural language
- use speech-to-text on mobile devices
- share reminder lists as iCalendar files
- integrate to calendar software and smartphone apps

#### Tools and services used

- `Node.js` with `express.js` web server framework
- `MongoDB` for database back-end
- `EJS` for html templating
- [`Cerebras`](https://cloud.cerebras.ai/) for generative AI
- [`Deepgram`](https://deepgram.com/) for speech-to-text
- `ical-generator` and `RRule-es` for generating iCalendar files
- [`Mailgun`](https://www.mailgun.com/) for sending e-mails (for user account confirmation)

#### Deployment

- Requires API keys configured in `.env` file for `Cerebras`, `Deepgram` and `Mailgun`.


Deployed at https://remindme-b5a1a3bf0219.herokuapp.com

###### by Mark Fruman `mark.fruman@yahoo.com`
