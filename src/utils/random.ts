export const delay = async (seconds: number): Promise<void> => {
    return new Promise(function (resolve) {
        setTimeout(resolve, seconds * 1000);
    });
}