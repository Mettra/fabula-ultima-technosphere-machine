interface Array<T> {
    unique<U>(
        this: T[],
        callback?: (value: T, count: number) => U
    ): ({ value: T; count: number } & U)[];

    /**
     * Maps each element to a Promise and awaits all of them concurrently.
     * @param callback A function that accepts up to three arguments and returns a Promise.
     * @returns A Promise that resolves to an array of all resolved values.
     */
    mapAsync<U>(
        this: T[],
        callback: (value: T, index: number, array: T[]) => Promise<U>
    ): Promise<U[]>;
}

Array.prototype.unique = function <T, U>(
    callback?: (value: T, count: number) => U
) {
    const arr = this as T[];
    const counts = arr.reduce((acc: Map<T, number>, val: T) => {
        acc.set(val, (acc.get(val) || 0) + 1);
        return acc;
    }, new Map<T, number>());

    return Array.from(counts.entries()).map(([value, count]) => {
        let callbackResult: U;
        if (callback) callbackResult = callback(value, count);
        return { value, count, ...callbackResult };
    });
};

Array.prototype.mapAsync = async function <T, U>(
    callback: (value: T, index: number, array: T[]) => Promise<U>
): Promise<U[]> {
    const promises = this.map(callback);
    return await Promise.all(promises);
};

interface Map<K, V> {
    /**
     * Gets the value associated with the specified key, or creates and sets a new value if the key is not already present.
     * @param key The key of the element to get or create.
     * @param defaultValue A function that returns the default value to be created and associated with the key if the key is not already present.
     * @returns The value associated with the key.
     */
    ensure(key: K, defaultValue: V): V;

    /**
     * Maps each key-value pair to a Promise and awaits all of them concurrently.
     * @param callback A function that accepts the value, key, and map and returns a Promise.
     * @returns A Promise that resolves to an array of all resolved values.
     */
    mapAsync<U>(
        callback: (value: V, key: K, map: Map<K, V>) => Promise<U>
    ): Promise<U[]>;
}

Map.prototype.ensure = function <K, V>(key: K, defaultValue: V): V {
    if (!this.has(key)) {
        this.set(key, defaultValue);
    }
    return this.get(key) as V;
};

Map.prototype.mapAsync = async function <K, V, U>(
    callback: (value: V, key: K, map: Map<K, V>) => Promise<U>
): Promise<U[]> {
    const promises = Array.from(this.entries()).map(([key, value]) =>
        callback(value, key, this)
    );
    return await Promise.all(promises);
};
