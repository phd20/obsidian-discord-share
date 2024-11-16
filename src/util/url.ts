export const isValidUrl = (urlString: string) => {
	let url;
	try {
		url = new URL(urlString);
	} catch (e) {
		console.error(e);
		return false;
	}
	return url.protocol === "http:" || url.protocol === "https:";
};
