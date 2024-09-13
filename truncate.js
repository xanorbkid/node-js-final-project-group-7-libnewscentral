// truncate.js
function truncateText(text, length) {
    if (text.length > length) {
        return text.substring(0, length) + '...';
    }
    return text;
}

module.exports = truncateText;
