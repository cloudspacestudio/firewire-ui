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

}