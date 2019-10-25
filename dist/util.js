function objectEquals(obj1, obj2, keysToCheck) {
    const theKeys = (Array.isArray(keysToCheck) ? keysToCheck : Object.keys(obj1));
    for (let i = 0; i < theKeys.length; i++) {
        const k = theKeys[i];
        const v1 = obj1[k];
    }
}
//# sourceMappingURL=util.js.map