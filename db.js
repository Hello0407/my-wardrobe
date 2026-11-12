const DB_NAME = "MyWardrobeDB";
const DB_VERSION = 1;
const STORES = ["items", "counters", "outfits"];

const ITEM_CATEGORIES = [
    "outerwear",
    "top",
    "bottom",
    "shoes",
    "accessories"
];

const COUNTER_CATEGORIES = ["underwear", "socks"];
const STATUSES = ["clean", "dirty"];

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const JPEG_PREFIX = "data:image/jpeg;base64,";

let connectionPromise = null;


// Открытие одного общего соединения.
function openDB() {
    if (connectionPromise) return connectionPromise;

    const attempt = new Promise((resolve, reject) => {
        let request;
        let upgradeError = null;
        let abandoned = false;

        try {
            request = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (error) {
            reject(new Error("Не удалось открыть базу данных.", {
                cause: error
            }));
            return;
        }

        request.onupgradeneeded = () => {
            const transaction = request.transaction;

            try {
                if (abandoned) {
                    transaction.abort();
                    return;
                }

                const db = request.result;

                db.createObjectStore("items", {
                    keyPath: "id"
                });

                const counters = db.createObjectStore("counters", {
                    keyPath: "category"
                });

                db.createObjectStore("outfits", {
                    keyPath: "id"
                });

                for (const category of COUNTER_CATEGORIES) {
                    counters.add({
                        category,
                        clean: 0,
                        dirty: 0
                    });
                }
            } catch (error) {
                upgradeError = error;

                try {
                    transaction.abort();
                } catch {
                    // Уже закрыта.
                }
            }
        };

        request.onerror = () => {
            reject(new Error("Не удалось инициализировать базу данных.", {
                cause: upgradeError || request.error
            }));
        };

        request.onblocked = () => {
            abandoned = true;

            reject(new Error(
                "База данных заблокирована. Закройте другие вкладки приложения и повторите попытку."
            ));
        };

        request.onsuccess = () => {
            const db = request.result;

            if (abandoned) {
                db.close();
                return;
            }

            const invalidate = () => {
                if (connectionPromise === shared) {
                    connectionPromise = null;
                }
            };

            db.onversionchange = () => {
                db.close();
                invalidate();
            };

            db.onclose = invalidate;

            resolve(db);
        };
    });

    const shared = attempt.catch((error) => {
        if (connectionPromise === shared) {
            connectionPromise = null;
        }

        throw error;
    });

    connectionPromise = shared;

    return shared;
}


// Выполнение транзакции.
async function runTransaction(storeNames, mode, work) {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        let transaction;

        try {
            transaction = db.transaction(storeNames, mode);
        } catch (error) {
            if (error.name === "InvalidStateError") {
                connectionPromise = null;
            }

            reject(new Error(
                "Не удалось начать транзакцию базы данных.",
                { cause: error }
            ));

            return;
        }

        let result;
        let failure = null;

        const fail = (error) => {
            if (!failure) {
                failure = error instanceof Error
                    ? error
                    : new Error(
                        "Ошибка операции с базой данных.",
                        { cause: error }
                    );
            }

            try {
                transaction.abort();
            } catch {
                // Уже закрыта.
            }
        };

        transaction.oncomplete = () => {
            if (failure) {
                reject(failure);
            } else {
                resolve(result);
            }
        };

        transaction.onerror = (event) => {
            fail(new Error("Ошибка транзакции базы данных.", {
                cause: event.target.error || transaction.error
            }));
        };

        transaction.onabort = () => {
            reject(failure || new Error(
                "Транзакция базы данных отменена.",
                { cause: transaction.error }
            ));
        };

        const setResult = (value) => {
            result = value;
        };

        const onSuccess = (request, callback) => {
            request.onsuccess = () => {
                if (failure) return;

                try {
                    callback(request.result);
                } catch (error) {
                    fail(error);
                }
            };
        };

        try {
            work(transaction, setResult, onSuccess);
        } catch (error) {
            fail(error);
        }
    });
}


// Проверка объектов.
function isRecord(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);
}


function requireRecord(value, label) {
    if (!isRecord(value)) {
        throw new Error(`${label}: ожидается объект.`);
    }
}


function requireFields(value, fields, label) {
    requireRecord(value, label);

    if (
        Object.keys(value).length !== fields.length ||
        !fields.every((field) => Object.hasOwn(value, field))
    ) {
        throw new Error(`${label}: неверный набор полей.`);
    }
}


// Проверка названия.
function validateName(name) {
    if (typeof name !== "string" || !name.trim()) {
        throw new Error("Название должно быть непустой строкой.");
    }

    return name.trim();
}


// Проверка категории вещи.
function validateItemCategory(category) {
    if (!ITEM_CATEGORIES.includes(category)) {
        throw new Error("Недопустимая категория вещи.");
    }
}


// Проверка категории счётчика.
function validateCounterCategory(category) {
    if (!COUNTER_CATEGORIES.includes(category)) {
        throw new Error("Недопустимая категория счётчика.");
    }
}


// Проверка статуса.
function validateStatus(status) {
    if (!STATUSES.includes(status)) {
        throw new Error("Недопустимый статус.");
    }
}


// Проверка UUID.
function validateUUID(id) {
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
        throw new Error("Некорректный формат UUID.");
    }
}


function validateLookupId(id) {
    if (typeof id !== "string") {
        throw new Error("ID должен быть строкой.");
    }
}


// Проверка счётчика.
function validateCount(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(
            "Счётчик должен быть неотрицательным безопасным целым числом."
        );
    }
}


// Безопасное сложение счётчиков.
function safeAdd(left, right) {
    const result = left + right;

    if (!Number.isSafeInteger(result) || result < 0) {
        throw new Error(
            "Переполнение счётчика: превышено допустимое значение."
        );
    }

    return result;
}


// Генерация UUID.
function generateId() {
    if (typeof globalThis.crypto?.randomUUID !== "function") {
        throw new Error(
            "Генерация UUID недоступна. Откройте приложение через HTTPS или localhost."
        );
    }

    return globalThis.crypto.randomUUID();
}


// Проверка base64 и JPEG.
async function validatePhoto(photo) {
    if (
        typeof photo !== "string" ||
        !photo.startsWith(JPEG_PREFIX)
    ) {
        throw new Error(
            "Фото должно быть JPEG Data URL в формате base64."
        );
    }

    const base64 = photo.slice(JPEG_PREFIX.length);

    if (!base64) {
        throw new Error(
            "Фото содержит пустые данные base64."
        );
    }

    let bytes;

    try {
        bytes = atob(base64);

        if (btoa(bytes) !== base64) {
            throw new Error("Неканонический base64.");
        }
    } catch (error) {
        throw new Error(
            "Не удалось декодировать base64 фотографии.",
            { cause: error }
        );
    }

    if (
        bytes.length < 4 ||
        bytes.charCodeAt(0) !== 0xff ||
        bytes.charCodeAt(1) !== 0xd8 ||
        bytes.charCodeAt(2) !== 0xff ||
        bytes.charCodeAt(bytes.length - 2) !== 0xff ||
        bytes.charCodeAt(bytes.length - 1) !== 0xd9
    ) {
        throw new Error(
            "Фото не является корректным JPEG-изображением."
        );
    }

    const image = new Image();

    try {
        image.src = photo;
        await image.decode();
    } catch (error) {
        throw new Error(
            "Не удалось декодировать JPEG-изображение.",
            { cause: error }
        );
    }

    if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        Math.max(image.naturalWidth, image.naturalHeight) > 800
    ) {
        throw new Error(
            "Максимальная сторона фотографии должна быть не более 800 пикселей."
        );
    }
}


// Проверка списка ID вещей.
function copyItemIds(itemIds) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
        throw new Error(
            "Образ должен содержать хотя бы одну вещь."
        );
    }

    const copy = Array.from(itemIds);
    const seen = new Set();

    for (const id of copy) {
        validateUUID(id);

        if (seen.has(id)) {
            throw new Error(
                "В образе не должно быть повторяющихся вещей."
            );
        }

        seen.add(id);
    }

    return copy;
}


// Проверка записи счётчика.
function requireCounter(counter, category) {
    if (!counter || counter.category !== category) {
        throw new Error("Не найдена запись счётчика.");
    }

    validateCount(counter.clean);
    validateCount(counter.dirty);

    return counter;
}


// Сортировка счётчиков.
function orderCounters(records) {
    if (records.length !== 2) {
        throw new Error(
            "В базе должно быть ровно два счётчика."
        );
    }

    return COUNTER_CATEGORIES.map((category) =>
        requireCounter(
            records.find((record) => record.category === category),
            category
        )
    );
}


// Получение всех записей.
function readAll(storeName) {
    return runTransaction(
        [storeName],
        "readonly",
        (tx, setResult, onSuccess) => {
            onSuccess(
                tx.objectStore(storeName).getAll(),
                setResult
            );
        }
    );
}


// Получение одной записи.
function readOne(storeName, id) {
    validateLookupId(id);

    return runTransaction(
        [storeName],
        "readonly",
        (tx, setResult, onSuccess) => {
            onSuccess(
                tx.objectStore(storeName).get(id),
                (record) => setResult(record ?? null)
            );
        }
    );
}


// ======================================
// ИНИЦИАЛИЗАЦИЯ
// ======================================

export async function initDB() {
    await openDB();
}


// ======================================
// ВЕЩИ
// ======================================

// Добавление вещи.
export async function addItem(data) {
    requireRecord(data, "Вещь");

    const { category, status, photo } = data;

    const name = validateName(data.name);

    validateItemCategory(category);
    validateStatus(status);

    await validatePhoto(photo);

    const record = {
        id: generateId(),
        name,
        category,
        status,
        photo
    };

    return runTransaction(
        ["items"],
        "readwrite",
        (tx, setResult) => {
            tx.objectStore("items").add(record);
            setResult(record);
        }
    );
}


// Получение всех вещей.
export async function getItems() {
    return readAll("items");
}


// Получение вещи по ID.
export async function getItem(id) {
    return readOne("items", id);
}


// Изменение статуса вещи.
export async function setItemStatus(id, status) {
    validateLookupId(id);
    validateStatus(status);

    return runTransaction(
        ["items"],
        "readwrite",
        (tx, setResult, onSuccess) => {
            const store = tx.objectStore("items");

            onSuccess(store.get(id), (record) => {
                if (!record) {
                    throw new Error(
                        "Вещь с указанным ID не найдена."
                    );
                }

                const updated = {
                    ...record,
                    status
                };

                store.put(updated);
                setResult(updated);
            });
        }
    );
}


// ======================================
// БЕЛЬЁ И НОСКИ
// ======================================

// Получение счётчиков.
export async function getCounters() {
    return orderCounters(await readAll("counters"));
}


// Изменение счётчика.
export async function adjustCounter(category, status, delta) {
    validateCounterCategory(category);
    validateStatus(status);

    if (delta !== 1 && delta !== -1) {
        throw new Error(
            "Изменение счётчика должно быть 1 или -1."
        );
    }

    return runTransaction(
        ["counters"],
        "readwrite",
        (tx, setResult, onSuccess) => {
            const store = tx.objectStore("counters");

            onSuccess(store.get(category), (record) => {
                requireCounter(record, category);

                const current = record[status];

                const next =
                    delta === -1 && current === 0
                        ? 0
                        : safeAdd(current, delta);

                const updated = {
                    ...record,
                    [status]: next
                };

                store.put(updated);
                setResult(updated);
            });
        }
    );
}


// Перенос чистого в грязное.
export async function moveCleanToDirty(category) {
    validateCounterCategory(category);

    return runTransaction(
        ["counters"],
        "readwrite",
        (tx, setResult, onSuccess) => {
            const store = tx.objectStore("counters");

            onSuccess(store.get(category), (record) => {
                requireCounter(record, category);

                if (record.clean === 0) {
                    setResult(record);
                    return;
                }

                const updated = {
                    ...record,
                    clean: record.clean - 1,
                    dirty: safeAdd(record.dirty, 1)
                };

                store.put(updated);
                setResult(updated);
            });
        }
    );
}


// Стирка всего белья и носков.
export async function washAllCounters() {
    return runTransaction(
        ["counters"],
        "readwrite",
        (tx, setResult, onSuccess) => {
            const store = tx.objectStore("counters");

            onSuccess(store.getAll(), (records) => {
                const updated = orderCounters(records).map(
                    (record) => ({
                        category: record.category,
                        clean: safeAdd(
                            record.clean,
                            record.dirty
                        ),
                        dirty: 0
                    })
                );

                for (const record of updated) {
                    store.put(record);
                }

                setResult(updated);
            });
        }
    );
}


// ======================================
// ОБРАЗЫ
// ======================================

// Создание образа.
export async function addOutfit(data) {
    requireRecord(data, "Образ");

    const name = validateName(data.name);
    const itemIds = copyItemIds(data.itemIds);

    const record = {
        id: generateId(),
        name,
        itemIds
    };

    return runTransaction(
        ["items", "outfits"],
        "readwrite",
        (tx, setResult, onSuccess) => {
            const items = tx.objectStore("items");
            const outfits = tx.objectStore("outfits");

            let remaining = itemIds.length;

            for (const id of itemIds) {
                onSuccess(items.get(id), (item) => {
                    if (!item) {
                        throw new Error(
                            `Вещь для образа не найдена: ${id}.`
                        );
                    }

                    remaining -= 1;

                    if (remaining === 0) {
                        outfits.add(record);
                        setResult(record);
                    }
                });
            }
        }
    );
}


// Получение всех образов.
export async function getOutfits() {
    return readAll("outfits");
}


// Получение образа по ID.
export async function getOutfit(id) {
    return readOne("outfits", id);
}


// ======================================
// РЕЗЕРВНАЯ КОПИЯ
// ======================================

// Экспорт резервной копии.
export async function exportBackup() {
    return runTransaction(
        STORES,
        "readonly",
        (tx, setResult, onSuccess) => {
            const backup = {
                format: "my-wardrobe",
                version: 1,
                items: [],
                counters: [],
                outfits: []
            };

            onSuccess(
                tx.objectStore("items").getAll(),
                (records) => {
                    backup.items = records;
                }
            );

            onSuccess(
                tx.objectStore("counters").getAll(),
                (records) => {
                    backup.counters = orderCounters(records);
                }
            );

            onSuccess(
                tx.objectStore("outfits").getAll(),
                (records) => {
                    backup.outfits = records;
                }
            );

            setResult(backup);
        }
    );
}


// Проверка резервной копии.
async function validateBackup(data) {
    requireFields(
        data,
        ["format", "version", "items", "counters", "outfits"],
        "Резервная копия"
    );

    if (
        data.format !== "my-wardrobe" ||
        data.version !== 1
    ) {
        throw new Error(
            "Неподдерживаемый формат или версия резервной копии."
        );
    }

    if (
        !Array.isArray(data.items) ||
        !Array.isArray(data.counters) ||
        !Array.isArray(data.outfits)
    ) {
        throw new Error(
            "Резервная копия должна содержать массивы items, counters и outfits."
        );
    }

    // Проверка вещей.
    const items = [];
    const itemIds = new Set();

    for (const record of data.items) {
        requireFields(
            record,
            ["id", "name", "category", "status", "photo"],
            "Вещь"
        );

        const {
            id,
            name,
            category,
            status,
            photo
        } = record;

        validateUUID(id);

        if (itemIds.has(id)) {
            throw new Error(
                "В резервной копии повторяется ID вещи."
            );
        }

        itemIds.add(id);

        validateName(name);
        validateItemCategory(category);
        validateStatus(status);

        items.push({
            id,
            name,
            category,
            status,
            photo
        });
    }

    // Проверка счётчиков.
    if (data.counters.length !== 2) {
        throw new Error(
            "В резервной копии должно быть ровно два счётчика."
        );
    }

    const counters = [];
    const categories = new Set();

    for (const record of data.counters) {
        requireFields(
            record,
            ["category", "clean", "dirty"],
            "Счётчик"
        );

        const {
            category,
            clean,
            dirty
        } = record;

        validateCounterCategory(category);

        if (categories.has(category)) {
            throw new Error(
                "В резервной копии повторяется категория счётчика."
            );
        }

        categories.add(category);

        validateCount(clean);
        validateCount(dirty);

        counters.push({
            category,
            clean,
            dirty
        });
    }

    // Проверка образов.
    const outfits = [];
    const outfitIds = new Set();

    for (const record of data.outfits) {
        requireFields(
            record,
            ["id", "name", "itemIds"],
            "Образ"
        );

        const { id, name } = record;

        validateUUID(id);

        if (outfitIds.has(id)) {
            throw new Error(
                "В резервной копии повторяется ID образа."
            );
        }

        outfitIds.add(id);

        validateName(name);

        const references = copyItemIds(record.itemIds);

        for (const itemId of references) {
            if (!itemIds.has(itemId)) {
                throw new Error(
                    `Образ ссылается на отсутствующую вещь: ${itemId}.`
                );
            }
        }

        outfits.push({
            id,
            name,
            itemIds: references
        });
    }

    // Проверка фотографий до транзакции.
    for (const item of items) {
        await validatePhoto(item.photo);
    }

    return {
        items,
        counters,
        outfits
    };
}


// Импорт резервной копии.
export async function importBackup(data) {
    const backup = await validateBackup(data);

    await runTransaction(
        STORES,
        "readwrite",
        (tx) => {
            // Очистка старых данных.
            for (const name of STORES) {
                tx.objectStore(name).clear();
            }

            // Запись новых данных.
            for (const name of STORES) {
                const store = tx.objectStore(name);

                for (const record of backup[name]) {
                    store.add(record);
                }
            }
        }
    );
}