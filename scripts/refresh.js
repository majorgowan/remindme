require("dotenv").config();
const { connectToDatabase, closeConnection } = require("../utils/db");
const { addWeeks, getDates } = require("../utils/dateutils");

async function refreshDates() {
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const reminderCollection = dbInstance.collection("reminders");
    // get all reminders that are not complete (i.e. all repeatDates accounted for)
    const incompletes = await reminderCollection.find(
        {
            "complete": {
                "$ne": true
            },
            "repeat": {
                "$ne": "never"
            }
        }
    );

    const today = new Date();
    // get date 12 weeks from now
    const twoYears = addWeeks(today, 12);

    for await (const reminder of incompletes) {
        const repeatDates = await getDates(reminder, reminder.date, new Date(twoYears));

        // is complete if it is repeating and the repeatDates array includes all occurrences
        const isComplete = (reminder.repeatDates
            && reminder.numberOfTimes
            && reminder.repeatDates.length >= reminder.numberOfTimes);

        if (isComplete) console.log(`Reminder complete (${reminder.repeatDates.length}, ${reminder.numberOfTimes})`);
        const result = await reminderCollection.updateOne(
            {
                _id: reminder._id,
            },
            {
                "$set": {
                    "complete": isComplete,
                    "repeatDates": repeatDates
                }
            }
        );
        console.log(result);

    }

    closeConnection();

}

refreshDates();
