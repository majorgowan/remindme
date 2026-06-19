const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const weekday = require("dayjs/plugin/weekday");
const { RRule } = require("rrule");

// Extend Day.js with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(weekday);


function toUTCDate(date, time, timezone) {
    const utcDate = dayjs.tz(`${date} ${time}`, timezone).utc();
    return utcDate.toDate();
}

function toLocalDate(datetime, timezone) {
    return dayjs.utc(datetime).tz(timezone).format("YYYY-MM-DD");
}

function groupByDay(reminders) {
    return reminders.reduce((groups, reminder) => {
        const groupKey = toLocalDate(reminder.datetime);
        (groups[groupKey] = groups[groupKey] || []).push(reminder);
        return groups;
    }, {});
}

function getWeekStart(reminder) {
    return dayjs(reminder.date).weekday(1).format("YYYY-MM-DD");
}

function groupByWeek(reminders) {
    return reminders.reduce((groups, reminder) => {
        const weekStart = getWeekStart(reminder);
        (groups[weekStart] = groups[weekStart] || []).push(reminder);
        return groups;
    }, {});
}

function repeatReminder(reminder, endDate) {
    // replicate the provided reminder at the specified frequency
    const repeatDates = reminder.repeatDates ? reminder.repeatDates.filter(rd => rd <= new Date(endDate)) : getDates(reminder, reminder.date, endDate);
    const repeats = repeatDates.map(rd => {
        const newReminder = {...reminder};
        newReminder.datetime = rd;
        newReminder.date = toLocalDate(rd, reminder.timezone);
        return newReminder;
    });
    return {"repeats": repeats, "complete": repeats.length >= reminder.numberOfTimes};
}

function addWeeks(date, number = 1) {
    nextWeek = new Date(date);
    nextWeek.setHours(23, 0, 0, 0);
    nextWeek.setDate(nextWeek.getDate() + 7 * number);
    return nextWeek.toISOString().slice(0, 10);
}

function reminderToRRule(reminder) {
    return new RRule({
        "freq": RRule[reminder.repeat.toUpperCase()],
        "dtstart": reminder.datetime,
        "count": reminder.numberOfTimes ? reminder.numberOfTimes : null,
        "interval": reminder.frequency ? reminder.frequency : null,
        "byweekday": reminder.daysOfWeek ? reminder.daysOfWeek.map(dow => RRule[dow.toUpperCase()]) : null,
        "bymonthday": reminder.daysOfMonth ? reminder.daysOfMonth : null,
        "bysetpos": reminder.setPosition ? reminder.setPosition : null,
    });
}

function getDates(reminder, startDate, endDate) {
    if (reminder.repeat === "never") return [reminder.datetime];

    const rule = reminderToRRule(reminder);
    return rule.between(new Date(startDate), new Date(endDate));
}


module.exports = { toUTCDate, groupByDay, groupByWeek, repeatReminder, addWeeks, reminderToRRule, getDates };