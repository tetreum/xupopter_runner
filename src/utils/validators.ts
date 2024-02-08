export const isValidUrl = (url: string): boolean => {
	try {
		return !!new URL(url);
	} catch (e) {
		return false;
	}
};
