export function createRicegrassUI() {
    const ricegrassContainer = document.getElementById('ricegrass-container');
    const ricegrassCount = document.getElementById('ricegrass-count');

    if (!ricegrassContainer || !ricegrassCount) {
        console.error('Failed to create ricegrass UI. Elements not found.');
        return;
    }

    ricegrassCount.textContent = '0';
}

export function updateRicegrassCount(count) {
    const ricegrassCount = document.getElementById('ricegrass-count');
    if (ricegrassCount) {
        ricegrassCount.textContent = count;
    }
}
