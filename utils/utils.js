const {connectToDatabase} = require("./db");
const {toLocalDate, addWeeks, repeatReminder, groupByWeek, groupByDay} = require("./dateutils");


function generateWeekDays(firstWeek, lastWeek) {
    // generate weeks of weekdays to cover interval (should accommodate empty weeks and empty days)
    const weekdays = {}
    let weekStart = firstWeek;
    while (weekStart <= lastWeek) {
        weekdays[weekStart] = [0, 1, 2, 3, 4, 5, 6].map(d => {
            const dobj = new Date(weekStart);
            dobj.setDate(dobj.getDate() + d);
            const day = dobj.toLocaleString(undefined, {"weekday": "short", "timeZone": "UTC"});
            const dateString = dobj.toLocaleString(undefined,
                {"month": "short", "day": "numeric", "timeZone": "UTC"});
            return {
                "date": dobj.toISOString().split("T")[0],
                "dateString": dateString,
                "day": day,
                "month": dobj.getUTCMonth() % 2 ? "even" : "odd"
            };
        });
        weekStart = addWeeks(weekStart, 1, false);
    }
    return weekdays;
}

async function fetchReminders(userId, startDate0, endDate0, timezone) {

    const startDate = startDate0 || toLocalDate(new Date(), timezone);
    const endDate = endDate0 || addWeeks(new Date(startDate), 3, true);

    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);

    // get reminders for this user
    const reminders = await dbInstance.collection("reminders").find(
        { "user": userId },
        { "sort": { "datetime": 1 }}
    );

    // generate repeated reminders
    let theresMore = null;
    let reminderList = [];
    for await (const reminder of reminders) {
        // skip reminders beyond endDate
        if (reminder.date > endDate) {
            theresMore = addWeeks(endDate, 2);
            continue;
        }

        if (reminder.repeat === "never") {
            // one-time events get pushed to reminder list
            if (!startDate || reminder.date >= startDate) {
                reminderList.push(reminder);
            }
        } else {
            // generate repeats from startDate to endDate
            const { repeats, complete } = repeatReminder(reminder, startDate, endDate);

            // if there are more repeats in the set, inlcude "Load more" link:
            if (!complete && !theresMore) theresMore = addWeeks(endDate, 4);

            // concatenate repeats to reminder list
            reminderList = reminderList.concat(repeats);
        }
    }

    // add some cosmetic stuff
    for (const reminder of reminderList) {
        reminder.day = reminder.datetime.toLocaleString(undefined,
            {"weekday": "long"});
        reminder.dateString = reminder.datetime.toLocaleString(undefined,
            {"month": "short", "day": "numeric"});
    }
    // sort reminders by date
    reminderList.sort((r1, r2) => {
        return (r1.datetime - r2.datetime);
    });

    // determine the next reminder
    const currentTime = new Date();
    for (const reminder of reminderList) {
        if (reminder.datetime > currentTime) {
            reminder.isNext = true;
            break;
        }
    }

    // group by week and day
    const reminderGroups = Object.fromEntries(
        Object.entries(groupByWeek(reminderList))
            .map(([week, group]) => [week, groupByDay(group)])
    );

    return {
        "reminderGroups": reminderGroups,
        "theresMore": theresMore
    }

}

module.exports = { fetchReminders, generateWeekDays };