

function getYouglishUrl(valueSelected)
{
    return `https://youglish.com/pronounce/${valueSelected.toLowerCase().trim()}/english/us`;
}


function getYouTubeUrl(valueSelected)
{
    return `https://www.youtube.com/results?search_query=${valueSelected.toLowerCase().trim()}`;
}


function getCambridgeUrl(valueSelected)
{
    return `https://dictionary.cambridge.org/dictionary/english/${valueSelected.toLowerCase().trim()}`;
}