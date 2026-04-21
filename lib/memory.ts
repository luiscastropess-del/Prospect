// In-memory buffer for the search results
let lastResults: any[] = [];

export const getResults = () => {
  const current = [...lastResults];
  lastResults = []; // Clear after fetch
  return current;
};

export const setResults = (results: any[]) => {
  lastResults = results;
};
