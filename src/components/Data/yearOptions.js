// Generate an array of year options from the current year to 1990
const currentYear = new Date().getFullYear();

export const yearOptions = Array.from({ length: currentYear - 1990 + 1 }, (_, index) => {
    const year = currentYear - index; // Start from current year and decrement
    return { value: year.toString(), label: year.toString() };
});
