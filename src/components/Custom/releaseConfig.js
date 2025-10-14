// src/components/Data/releaseConfig.js

// Button configuration
export const buttons = [
    { label: "Core Info", value: "coreInfo" },
    { label: "Tracks", value: "tracks" },
    { label: "Scheduling", value: "scheduling" },
    { label: "All", value: "all" },
];

// Function to handle release type changes
export const handleReleaseTypeChange = (setReleaseType) => (type) => {
    setReleaseType(type);
};
