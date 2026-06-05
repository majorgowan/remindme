function groupByDay(data) {
   return data.reduce((groups, item) => {
       const groupKey = item.date;
       (groups[groupKey] = groups[groupKey] || []).push(item);
       return groups;
   }, {});
}

function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const newDate = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
    return new Date(d.setDate(newDate)).toISOString().slice(0, 10);
}

function groupByWeek(data) {
    return data.reduce((groups, item) => {
        const weekStart = getWeekStart(item.datetime);
        (groups[weekStart] = groups[weekStart] || []).push(item);
        return groups;
    }, {});
}

module.exports = { groupByDay, groupByWeek }