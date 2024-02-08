export const delay = async (seconds: number): Promise<void> => {
	return new Promise(function (resolve) {
		setTimeout(resolve, seconds * 1000);
	});
};

export const deepClone = <T>(obj: T): T => {
	return JSON.parse(JSON.stringify(obj));
};
