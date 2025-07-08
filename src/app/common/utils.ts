export class Utils {

    static toLocalString(input: Date|string) {
        if (!input) {
            return ''
        }
        try {
            const test = new Date(input)
            return test.toLocaleString()
        } catch {
            return ''
        }
    }

    static getGoogleMapLink(line: string) {
        const phrase = line
        return `https://www.google.com/maps/place/${phrase}`
    }

    static getDateDayTimeRange(input: Date): DateDayTimeRange {
        const startOfDay = new Date(input)
        // Set the time to midnight (00:00:00.000) using setHours
        startOfDay.setHours(0, 0, 0, 0); 

        // Create another new Date object
        const endOfDay = new Date(input);
        // Set the time to just before midnight (23:59:59.999) using setHours
        endOfDay.setHours(23, 59, 59, 999); 

        return { start: startOfDay, end: endOfDay };
    }
}

export interface DateDayTimeRange {
    start: Date
    end: Date
}