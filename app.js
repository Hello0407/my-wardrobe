
import {
    initDB,
    addItem,
    getItems,
    setItemStatus,
    getCounters,
    adjustCounter,
    moveCleanToDirty,
    washAllCounters,
    addOutfit,
    getOutfits
} from "./db.js";


// Экраны и навигация
const screens = document.querySelectorAll(".screen");

const navButtons = document.querySelectorAll(
    ".nav-button[data-screen]"
);

const filterButtons = document.querySelectorAll(
    ".filter-button[data-filter]"
);


// Экран вещей
const itemsContent = document.getElementById("items-content");
const itemsList = document.getElementById("items-list");
const itemsEmptyState = document.getElementById("items-empty-state");
const itemsStateMessage = document.getElementById("items-state-message");
const itemsStatusError = document.getElementById("items-status-error");
const itemsMessage = document.getElementById("items-message");
const addItemButton = document.getElementById("add-item-button");


// Экран счётчиков
const countersScreen = document.getElementById("screen-counters");
const countersStateMessage = document.getElementById("counters-state-message");
const countersError = document.getElementById("counters-error");

const counterButtons = countersScreen.querySelectorAll(
    "[data-delta]"
);

const moveButtons = countersScreen.querySelectorAll(
    "[data-move-category]"
);

const washAllButton = document.getElementById("wash-all-button");

const counterCategories = ["underwear", "socks"];
const counterStatuses = ["clean", "dirty"];


// Экран образов
const outfitsContent = document.getElementById("outfits-content");
const outfitsList = document.getElementById("outfits-list");
const outfitsEmptyState = document.getElementById("outfits-empty-state");
const outfitsStateMessage = document.getElementById("outfits-state-message");
const outfitsMessage = document.getElementById("outfits-message");
const outfitsError = document.getElementById("outfits-error");
const outfitsCreateHint = document.getElementById("outfits-create-hint");

const addOutfitButton = document.getElementById("add-outfit-button");

const outfitForm = document.getElementById("add-outfit-form");
const outfitFormTitle = document.getElementById("add-outfit-title");
const outfitFormFields = document.getElementById("outfit-form-fields");
const outfitNameInput = document.getElementById("outfit-name");

const outfitPicker = document.getElementById("outfit-picker");

const outfitSelectedCount = document.getElementById(
    "outfit-selected-count"
);

const outfitFormError = document.getElementById("outfit-form-error");
const outfitSaveMessage = document.getElementById("outfit-save-message");

const saveOutfitButton = document.getElementById("save-outfit-button");
const cancelOutfitButton = document.getElementById("cancel-outfit-button");

const outfitDetail = document.getElementById("outfit-detail");
const outfitDetailTitle = document.getElementById("outfit-detail-title");
const outfitDetailItems = document.getElementById("outfit-detail-items");

const backToOutfitsButton = document.getElementById(
    "back-to-outfits-button"
);


// Форма добавления вещи
const itemForm = document.getElementById("add-item-form");
const formTitle = document.getElementById("add-item-title");
const formFields = document.getElementById("item-form-fields");

const photoInput = document.getElementById("item-photo");
const nameInput = document.getElementById("item-name");
const categoryInput = document.getElementById("item-category");

const photoPreviewContainer = document.getElementById(
    "photo-preview-container"
);

const photoPreview = document.getElementById("photo-preview");
const photoMessage = document.getElementById("photo-message");
const formError = document.getElementById("item-form-error");
const saveMessage = document.getElementById("save-message");

const saveItemButton = document.getElementById("save-item-button");
const cancelItemButton = document.getElementById("cancel-item-button");


// Категории в фиксированном порядке
const categories = [
    {
        value: "outerwear",
        label: "Верхняя одежда"
    },
    {
        value: "top",
        label: "Верх"
    },
    {
        value: "bottom",
        label: "Низ"
    },
    {
        value: "shoes",
        label: "Обувь"
    },
    {
        value: "accessories",
        label: "Аксессуары"
    }
];

const allowedCategories = new Set(
    categories.map((category) => category.value)
);

const allowedStatuses = new Set([
    "clean",
    "dirty"
]);


// Настройки сжатия
const MAX_PHOTO_SIZE = 800;
const PHOTO_QUALITY = 0.8;


// Состояние вещей
let items = [];
let activeFilter = "all";

let isDatabaseReady = false;

let hasLoadedItems = false;
let isLoadingItems = false;
let itemsLoadError = "";

let isUpdatingStatus = false;
let isSaving = false;

let isProcessingPhoto = false;
let compressedPhoto = null;
let photoRequestId = 0;


// Состояние счётчиков
let counters = null;

let isLoadingCounters = false;
let isUpdatingCounters = false;
let countersLoadError = "";


// Состояние образов
let outfits = [];

let hasLoadedOutfits = false;
let isLoadingOutfits = false;
let isSavingOutfit = false;

let outfitsLoadError = "";

const selectedItemIds = new Set();

let viewedOutfitId = null;


// Проверяет занятость операций со списком
function isItemsBusy() {
    return (
        isLoadingItems ||
        isUpdatingStatus ||
        isSaving
    );
}


// Обновляет доступность действий со списком
function updateItemsControls() {
    const busy = isItemsBusy();

    addItemButton.disabled =
        !isDatabaseReady || busy;

    itemsList
        .querySelectorAll(".item-status-button")
        .forEach((button) => {
            button.disabled =
                !isDatabaseReady || busy;
        });

    updateSaveButton();
}


// Общая блокировка нижней навигации
function updateNavigationControls() {
    navButtons.forEach((button) => {
        button.disabled =
            isSaving || isSavingOutfit;
    });
}


// Показывает выбранный экран
function showScreen(screenName) {
    if (isSaving || isSavingOutfit) {
        return;
    }

    const targetScreen = document.getElementById(
        `screen-${screenName}`
    );

    if (
        !targetScreen ||
        !targetScreen.classList.contains("screen")
    ) {
        return;
    }

    // Закрываем незавершённую форму вещи
    if (
        screenName !== "items" &&
        !itemForm.hidden
    ) {
        closeItemForm();
    }

    // Закрываем форму и просмотр образа
    if (screenName !== "outfits") {
        if (!outfitForm.hidden) {
            closeOutfitForm();
        }

        if (!outfitDetail.hidden) {
            closeOutfitDetail();
        }
    }

    screens.forEach((screen) => {
        screen.hidden = screen !== targetScreen;
    });

    navButtons.forEach((button) => {
        const isActive =
            button.dataset.screen === screenName;

        button.classList.toggle(
            "is-active",
            isActive
        );

        if (isActive) {
            button.setAttribute(
                "aria-current",
                "page"
            );
        } else {
            button.removeAttribute(
                "aria-current"
            );
        }
    });

    // Показываем актуальные счётчики
    if (screenName === "counters") {
        renderCounters();
    }

    // Показываем актуальные образы
    if (screenName === "outfits") {
        refreshOutfits();
    }

    window.scrollTo(0, 0);
}


// Переключает фильтр без обращения к базе
function setActiveFilter(filterName) {
    const filterExists = Array
        .from(filterButtons)
        .some(
            (button) =>
                button.dataset.filter === filterName
        );

    if (!filterExists) {
        return;
    }

    activeFilter = filterName;

    filterButtons.forEach((button) => {
        const isActive =
            button.dataset.filter === activeFilter;

        button.classList.toggle(
            "is-active",
            isActive
        );

        button.setAttribute(
            "aria-pressed",
            String(isActive)
        );
    });

    renderItems();
}


// Проверяет соответствие активному фильтру
function matchesFilter(item) {
    return (
        activeFilter === "all" ||
        item.status === activeFilter
    );
}


// Показывает загрузку, пустое состояние или ошибку
function showItemsState(message, isError = false) {
    itemsEmptyState.hidden = false;

    itemsStateMessage.textContent = message;

    itemsStateMessage.classList.toggle(
        "is-error",
        isError
    );
}


// Создаёт карточку вещи
function createItemCard(item) {
    const card = document.createElement("article");

    card.className = "card item-card";

    const photoFrame = document.createElement("div");

    photoFrame.className = "item-photo-frame";

    const photo = document.createElement("img");

    photo.className = "item-photo";
    photo.src = item.photo;
    photo.alt = `Фотография: ${item.name}`;
    photo.loading = "lazy";

    photoFrame.append(photo);

    const name = document.createElement("h3");

    name.className = "item-name";
    name.textContent = item.name;

    const statusButton = document.createElement("button");

    const isClean = item.status === "clean";

    statusButton.type = "button";

    statusButton.className =
        "button item-status-button";

    statusButton.classList.add(
        isClean ? "is-clean" : "is-dirty"
    );

    statusButton.textContent =
        isClean ? "Чисто" : "Грязно";

    const nextStatusLabel =
        isClean ? "грязно" : "чисто";

    statusButton.setAttribute(
        "aria-label",
        `${item.name}: ${statusButton.textContent}. ` +
        `Изменить статус на «${nextStatusLabel}»`
    );

    statusButton.disabled =
        !isDatabaseReady || isItemsBusy();

    statusButton.addEventListener(
        "click",
        () => {
            handleStatusChange(item.id);
        }
    );

    card.append(
        photoFrame,
        name,
        statusButton
    );

    return card;
}


// Отображает вещи по категориям
function renderItems() {
    itemsList.replaceChildren();

    itemsEmptyState.hidden = true;

    // Загрузка
    if (isLoadingItems) {
        showItemsState("Загрузка вещей…");
        return;
    }

    // Ошибка чтения
    if (itemsLoadError) {
        showItemsState(itemsLoadError, true);
        return;
    }

    // Данные ещё не загружены
    if (!hasLoadedItems) {
        showItemsState("Загрузка вещей…");
        return;
    }

    // Гардероб пуст
    if (items.length === 0) {
        showItemsState(
            "В гардеробе пока нет вещей"
        );
        return;
    }

    // Применяем текущий фильтр
    const visibleItems = items.filter(
        matchesFilter
    );

    if (visibleItems.length === 0) {
        const message =
            activeFilter === "clean"
                ? "Нет чистых вещей"
                : "Нет грязных вещей";

        showItemsState(message);
        return;
    }

    const fragment =
        document.createDocumentFragment();

    // Фиксированный порядок категорий
    categories.forEach((category) => {
        const categoryItems = visibleItems.filter(
            (item) =>
                item.category === category.value
        );

        if (categoryItems.length === 0) {
            return;
        }

        const section =
            document.createElement("section");

        section.className = "item-category";

        const title =
            document.createElement("h2");

        title.id =
            `items-category-${category.value}`;

        title.textContent =
            category.label;

        section.setAttribute(
            "aria-labelledby",
            title.id
        );

        const grid =
            document.createElement("div");

        grid.className = "items-grid";

        categoryItems.forEach((item) => {
            grid.append(
                createItemCard(item)
            );
        });

        section.append(
            title,
            grid
        );

        fragment.append(section);
    });

    itemsList.append(fragment);
}


// Загружает список вещей из базы
async function loadItems() {
    if (
        isLoadingItems ||
        isUpdatingStatus ||
        !isDatabaseReady
    ) {
        return;
    }

    isLoadingItems = true;

    itemsLoadError = "";

    updateItemsControls();

    refreshOutfits();

    renderItems();

    try {
        items = await getItems();

        hasLoadedItems = true;

    } catch (error) {
        console.error(
            "Ошибка загрузки вещей:",
            error
        );

        hasLoadedItems = false;

        itemsLoadError =
            "Не удалось загрузить вещи. " +
            "Попробуйте перезагрузить приложение.";

    } finally {
        isLoadingItems = false;

        refreshOutfits();

        renderItems();

        updateItemsControls();
    }
}


// Переключает статус вещи
async function handleStatusChange(itemId) {
    if (
        !isDatabaseReady ||
        !hasLoadedItems ||
        isItemsBusy() ||
        !itemForm.hidden
    ) {
        return;
    }

    const itemIndex = items.findIndex(
        (item) => item.id === itemId
    );

    if (itemIndex === -1) {
        return;
    }

    const item = items[itemIndex];

    const newStatus =
        item.status === "clean"
            ? "dirty"
            : "clean";

    isUpdatingStatus = true;

    itemsStatusError.textContent = "";

    updateItemsControls();

    let updated = false;

    try {
        const updatedItem = await setItemStatus(
            item.id,
            newStatus
        );

        // Используем подтверждённую запись
        items[itemIndex] = updatedItem;

        updated = true;

    } catch (error) {
        console.error(
            "Ошибка изменения статуса вещи:",
            error
        );

        itemsStatusError.textContent =
            "Не удалось изменить статус вещи. " +
            "Попробуйте ещё раз.";

    } finally {
        isUpdatingStatus = false;

        if (updated) {
            refreshOutfits();

            renderItems();
        }

        updateItemsControls();
    }
}


// Обновляет кнопку сохранения вещи
function updateSaveButton() {
    saveItemButton.disabled =
        !isDatabaseReady ||
        isItemsBusy() ||
        isProcessingPhoto ||
        !compressedPhoto;
}


// Очищает предварительный просмотр
function clearPhotoPreview() {
    photoPreview.removeAttribute("src");

    photoPreviewContainer.hidden = true;
}


// Полностью очищает форму вещи
function resetItemForm() {
    // Отменяем старые результаты обработки
    photoRequestId += 1;

    itemForm.reset();

    compressedPhoto = null;

    isProcessingPhoto = false;

    clearPhotoPreview();

    photoMessage.textContent = "";
    formError.textContent = "";
    saveMessage.textContent = "";

    updateSaveButton();
}


// Открывает форму добавления вещи
function openItemForm() {
    if (
        !isDatabaseReady ||
        isItemsBusy() ||
        !itemForm.hidden
    ) {
        return;
    }

    resetItemForm();

    itemsMessage.textContent = "";

    itemsStatusError.textContent = "";

    itemsContent.hidden = true;

    itemForm.hidden = false;

    addItemButton.setAttribute(
        "aria-expanded",
        "true"
    );

    window.scrollTo(0, 0);

    formTitle.focus();
}


// Закрывает и очищает форму вещи
function closeItemForm() {
    resetItemForm();

    itemForm.hidden = true;

    itemsContent.hidden = false;

    addItemButton.setAttribute(
        "aria-expanded",
        "false"
    );
}


// Блокирует интерфейс при сохранении вещи
function setSavingState(saving) {
    isSaving = saving;

    formFields.disabled = saving;

    cancelItemButton.disabled = saving;

    updateNavigationControls();

    saveItemButton.textContent =
        saving
            ? "Сохранение…"
            : "Сохранить вещь";

    saveMessage.textContent =
        saving
            ? "Сохранение…"
            : "";

    updateItemsControls();

    updateOutfitControls();
}


// Сжимает фотографию до JPEG
async function compressPhoto(file) {
    if (
        !(file instanceof Blob) ||
        file.size === 0
    ) {
        throw new Error(
            "Выбран пустой или некорректный файл."
        );
    }

    const objectURL =
        URL.createObjectURL(file);

    try {
        const image = new Image();

        // Декодируем изображение
        await new Promise(
            (resolve, reject) => {
                image.onload = () => {
                    resolve();
                };

                image.onerror = () => {
                    reject(
                        new Error(
                            "Не удалось декодировать изображение."
                        )
                    );
                };

                image.src = objectURL;
            }
        );

        const originalWidth = image.naturalWidth;
        const originalHeight = image.naturalHeight;

        // Проверяем размеры
        if (
            !Number.isFinite(originalWidth) ||
            !Number.isFinite(originalHeight) ||
            originalWidth <= 0 ||
            originalHeight <= 0
        ) {
            throw new Error(
                "Некорректные размеры изображения."
            );
        }

        // Сохраняем пропорции
        const scale = Math.min(
            1,
            MAX_PHOTO_SIZE / Math.max(
                originalWidth,
                originalHeight
            )
        );

        const width = Math.max(
            1,
            Math.round(originalWidth * scale)
        );

        const height = Math.max(
            1,
            Math.round(originalHeight * scale)
        );

        // Создаём canvas
        const canvas = document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error(
                "Не удалось создать контекст canvas."
            );
        }

        // Заполняем фон белым
        context.fillStyle = "#ffffff";

        context.fillRect(
            0,
            0,
            width,
            height
        );

        // Рисуем уменьшенное изображение
        context.imageSmoothingEnabled = true;

        context.imageSmoothingQuality = "high";

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        // Преобразуем в JPEG
        const result = canvas.toDataURL(
            "image/jpeg",
            PHOTO_QUALITY
        );

        const jpegPrefix =
            "data:image/jpeg;base64,";

        // Проверяем формат
        if (
            typeof result !== "string" ||
            !result.startsWith(jpegPrefix) ||
            result.length <= jpegPrefix.length
        ) {
            throw new Error(
                "Не удалось получить JPEG-изображение."
            );
        }

        // Проверяем сигнатуру JPEG
        const base64 = result.slice(
            jpegPrefix.length
        );

        if (!base64.startsWith("/9j/")) {
            throw new Error(
                "Получены некорректные JPEG-данные."
            );
        }

        return result;

    } finally {
        URL.revokeObjectURL(objectURL);
    }
}


// Обрабатывает выбранную фотографию
async function handlePhotoChange() {
    if (
        isSaving ||
        itemForm.hidden
    ) {
        return;
    }

    const requestId = ++photoRequestId;

    const file = photoInput.files[0];

    compressedPhoto = null;

    isProcessingPhoto = false;

    clearPhotoPreview();

    photoMessage.textContent = "";

    formError.textContent = "";

    updateSaveButton();

    if (!file) {
        return;
    }

    isProcessingPhoto = true;

    photoMessage.textContent =
        "Обработка фотографии…";

    updateSaveButton();

    try {
        const result = await compressPhoto(file);

        // Игнорируем устаревший результат
        if (
            requestId !== photoRequestId ||
            itemForm.hidden
        ) {
            return;
        }

        compressedPhoto = result;

        photoPreview.src = compressedPhoto;

        photoPreviewContainer.hidden = false;

        photoMessage.textContent =
            "Фотография готова.";

    } catch (error) {
        if (
            requestId !== photoRequestId ||
            itemForm.hidden
        ) {
            return;
        }

        console.error(
            "Ошибка обработки фотографии:",
            error
        );

        compressedPhoto = null;

        clearPhotoPreview();

        photoInput.value = "";

        photoMessage.textContent = "";

        formError.textContent =
            "Не удалось обработать фотографию. " +
            "Попробуйте выбрать изображение " +
            "в формате JPEG или PNG.";

    } finally {
        if (
            requestId === photoRequestId &&
            !itemForm.hidden
        ) {
            isProcessingPhoto = false;

            updateSaveButton();
        }
    }
}


// Проверяет данные новой вещи
function getValidatedItemData() {
    formError.textContent = "";

    // Проверяем фотографию
    if (
        isProcessingPhoto ||
        !compressedPhoto ||
        !photoInput.files.length
    ) {
        formError.textContent =
            "Выберите фотографию и дождитесь " +
            "завершения её обработки.";

        photoInput.focus();

        return null;
    }

    // Проверяем название
    const name = nameInput.value.trim();

    if (!name) {
        formError.textContent =
            "Введите название вещи.";

        nameInput.focus();

        return null;
    }

    // Проверяем категорию
    const category = categoryInput.value;

    if (!allowedCategories.has(category)) {
        formError.textContent =
            "Выберите категорию вещи.";

        categoryInput.focus();

        return null;
    }

    // Проверяем статус
    const statusInput = itemForm.querySelector(
        'input[name="status"]:checked'
    );

    const status = statusInput?.value;

    if (!allowedStatuses.has(status)) {
        formError.textContent =
            "Выберите статус вещи.";

        const firstStatusInput =
            itemForm.querySelector(
                'input[name="status"]'
            );

        firstStatusInput?.focus();

        return null;
    }

    return {
        name,
        category,
        status,
        photo: compressedPhoto
    };
}


// Сохраняет новую вещь
async function handleItemSubmit(event) {
    event.preventDefault();

    if (
        !isDatabaseReady ||
        isItemsBusy() ||
        itemForm.hidden
    ) {
        return;
    }

    const data = getValidatedItemData();

    if (!data) {
        return;
    }

    setSavingState(true);

    let savedItem;

    try {
        // UUID создаётся внутри db.js
        savedItem = await addItem(data);

    } catch (error) {
        console.error(
            "Ошибка сохранения вещи:",
            error
        );

        formError.textContent =
            "Не удалось сохранить вещь. " +
            "Попробуйте ещё раз.";

        setSavingState(false);

        return;
    }

    // Вещь уже сохранена
    try {
        closeItemForm();

        itemsMessage.textContent =
            matchesFilter(savedItem)
                ? "Вещь добавлена"
                : "Вещь добавлена. Она скрыта текущим фильтром.";

        if (hasLoadedItems) {
            items.push(savedItem);

            renderItems();

        } else {
            // Повторное чтение после ошибки
            await loadItems();
        }

    } catch (error) {
        console.error(
            "Ошибка обновления списка вещей:",
            error
        );

        hasLoadedItems = false;

        itemsLoadError =
            "Вещь сохранена, но не удалось обновить список. " +
            "Попробуйте перезагрузить приложение.";

        renderItems();

    } finally {
        setSavingState(false);

        // Новая вещь доступна для образов
        refreshOutfits();
    }

    window.scrollTo(0, 0);

    addItemButton.focus();
}


// Отображает подтверждённые счётчики
function renderCounters() {
    const ready =
        isDatabaseReady &&
        counters !== null &&
        !isLoadingCounters;

    const blocked =
        !ready ||
        isUpdatingCounters;

    countersStateMessage.textContent =
        !ready && !countersLoadError
            ? "Загрузка…"
            : "";

    // Обновляем обе категории
    for (const category of counterCategories) {
        for (const status of counterStatuses) {
            const value = document.getElementById(
                `${category}-${status}`
            );

            value.textContent =
                ready
                    ? String(counters[category][status])
                    : "—";
        }
    }

    // Блокируем уменьшение при нуле
    counterButtons.forEach((button) => {
        const {
            category,
            status,
            delta
        } = button.dataset;

        button.disabled =
            blocked ||
            (
                Number(delta) === -1 &&
                counters[category][status] === 0
            );
    });

    // Блокируем перенос при отсутствии чистых
    moveButtons.forEach((button) => {
        button.disabled =
            blocked ||
            counters[button.dataset.moveCategory].clean === 0;
    });

    // Стирка при наличии грязных
    washAllButton.disabled =
        blocked ||
        counterCategories.every(
            (category) =>
                counters[category].dirty === 0
        );
}


// Загружает счётчики
async function loadCounters() {
    if (
        !isDatabaseReady ||
        isLoadingCounters ||
        isUpdatingCounters
    ) {
        return;
    }

    isLoadingCounters = true;

    countersLoadError = "";

    countersError.textContent = "";

    renderCounters();

    try {
        const records = await getCounters();

        counters = Object.fromEntries(
            records.map(
                (record) => [
                    record.category,
                    record
                ]
            )
        );

    } catch (error) {
        console.error(
            "Ошибка загрузки счётчиков:",
            error
        );

        counters = null;

        countersLoadError =
            "Не удалось загрузить количества. " +
            "Попробуйте перезагрузить приложение.";

        countersError.textContent =
            countersLoadError;

    } finally {
        isLoadingCounters = false;

        renderCounters();
    }
}


// Выполняет операцию со счётчиками
async function updateCounters(
    operation,
    errorMessage
) {
    if (
        !isDatabaseReady ||
        counters === null ||
        isLoadingCounters ||
        isUpdatingCounters
    ) {
        return;
    }

    isUpdatingCounters = true;

    countersError.textContent = "";

    renderCounters();

    try {
        const result = await operation();

        const records =
            Array.isArray(result)
                ? result
                : [result];

        // Используем подтверждённые записи
        const nextCounters = {
            ...counters
        };

        for (const record of records) {
            nextCounters[record.category] = record;
        }

        counters = nextCounters;

    } catch (error) {
        console.error(
            "Ошибка изменения счётчиков:",
            error
        );

        countersError.textContent =
            errorMessage;

    } finally {
        isUpdatingCounters = false;

        renderCounters();
    }
}


// Изменяет количество
function handleCounterAdjustment(button) {
    if (button.disabled) {
        return;
    }

    const {
        category,
        status,
        delta
    } = button.dataset;

    return updateCounters(
        () => adjustCounter(
            category,
            status,
            Number(delta)
        ),
        "Не удалось изменить количество. Попробуйте ещё раз."
    );
}


// Переносит одну единицу в грязные
function handleCounterMove(button) {
    if (button.disabled) {
        return;
    }

    return updateCounters(
        () => moveCleanToDirty(
            button.dataset.moveCategory
        ),
        "Не удалось изменить количество. Попробуйте ещё раз."
    );
}


// Стирает бельё и носки
function handleWashAll() {
    if (washAllButton.disabled) {
        return;
    }

    return updateCounters(
        () => washAllCounters(),
        "Не удалось выполнить стирку. Попробуйте ещё раз."
    );
}


// Проверяет доступность создания образа
function canCreateOutfit() {
    return (
        isDatabaseReady &&
        hasLoadedOutfits &&
        hasLoadedItems &&
        !isLoadingOutfits &&
        !isLoadingItems &&
        !isSaving &&
        !isSavingOutfit &&
        !outfitsLoadError &&
        !itemsLoadError &&
        items.length > 0
    );
}


// Обновляет кнопки и количество выбранных
function updateOutfitControls() {
    addOutfitButton.disabled =
        !canCreateOutfit();

    saveOutfitButton.disabled =
        !canCreateOutfit() ||
        outfitForm.hidden ||
        !outfitNameInput.value.trim() ||
        selectedItemIds.size === 0;

    outfitSelectedCount.textContent =
        `Выбрано вещей: ${selectedItemIds.size}`;

    outfitsCreateHint.textContent =
        hasLoadedItems &&
        !isLoadingItems &&
        !itemsLoadError &&
        items.length === 0
            ? "Сначала добавь вещи в гардероб"
            : "";
}


// Создаёт фотографию вещи для образа
function createOutfitPhoto(
    item,
    decorative = false
) {
    const frame = document.createElement("span");

    frame.className = "item-photo-frame";

    // Обрабатываем отсутствующую вещь
    if (!item) {
        frame.classList.add(
            "outfit-missing-photo"
        );

        frame.textContent =
            "Вещь отсутствует";

        return frame;
    }

    const photo = document.createElement("img");

    photo.className = "item-photo";

    photo.src = item.photo;

    photo.alt =
        decorative
            ? ""
            : `Фотография: ${item.name}`;

    photo.loading = "lazy";

    frame.append(photo);

    return frame;
}


// Создаёт карточку сохранённого образа
function createOutfitCard(
    outfit,
    itemsById
) {
    const card = document.createElement("article");

    card.className = "card outfit-card";

    const title = document.createElement("h2");

    title.textContent = outfit.name;

    const count = document.createElement("p");

    count.className = "form-hint";

    count.textContent =
        `Количество вещей: ${outfit.itemIds.length}`;

    const grid = document.createElement("div");

    grid.className = "items-grid";

    // Показываем до четырёх фотографий
    for (const id of outfit.itemIds.slice(0, 4)) {
        const item = itemsById.get(id);

        grid.append(
            createOutfitPhoto(item)
        );
    }

    card.append(
        title,
        count,
        grid
    );

    // Показываем количество остальных вещей
    if (outfit.itemIds.length > 4) {
        const more = document.createElement("p");

        more.className = "form-hint";

        more.textContent =
            `Ещё вещей: ${outfit.itemIds.length - 4}`;

        card.append(more);
    }

    const button = document.createElement("button");

    button.type = "button";

    button.className =
        "button button-secondary button-full";

    button.textContent =
        "Посмотреть образ";

    button.setAttribute(
        "aria-label",
        `Посмотреть образ: ${outfit.name}`
    );

    button.addEventListener(
        "click",
        () => {
            openOutfitDetail(outfit.id);
        }
    );

    card.append(button);

    return card;
}


// Отображает список сохранённых образов
function renderOutfits() {
    outfitsList.replaceChildren();

    outfitsEmptyState.hidden = true;

    outfitsStateMessage.textContent = "";

    // Ошибки выводятся отдельно
    if (
        outfitsLoadError ||
        itemsLoadError
    ) {
        return;
    }

    // Загрузка образов
    if (
        isLoadingOutfits ||
        !hasLoadedOutfits
    ) {
        outfitsEmptyState.hidden = false;

        outfitsStateMessage.textContent =
            "Загрузка образов…";

        return;
    }

    // Ожидаем загрузку вещей
    if (
        !hasLoadedItems ||
        isLoadingItems
    ) {
        outfitsEmptyState.hidden = false;

        outfitsStateMessage.textContent =
            "Загрузка вещей…";

        return;
    }

    // Пустой список
    if (outfits.length === 0) {
        outfitsEmptyState.hidden = false;

        outfitsStateMessage.textContent =
            "У тебя пока нет образов";

        return;
    }

    // Используем общий массив вещей
    const itemsById = new Map(
        items.map(
            (item) => [
                item.id,
                item
            ]
        )
    );

    const fragment =
        document.createDocumentFragment();

    for (const outfit of outfits) {
        const card = createOutfitCard(
            outfit,
            itemsById
        );

        fragment.append(card);
    }

    outfitsList.append(fragment);
}


// Обновляет состояние раздела образов
function refreshOutfits() {
    try {
        updateOutfitControls();

        outfitsError.textContent =
            outfitsLoadError ||
            (
                itemsLoadError
                    ? `Не удалось показать образы. ${itemsLoadError}`
                    : ""
            );

        renderOutfits();

        // Сохраняем текущий выбор при отрисовке
        if (
            !outfitForm.hidden &&
            !isSavingOutfit &&
            hasLoadedItems &&
            !isLoadingItems
        ) {
            renderOutfitPicker();
        }

        // Обновляем открытый образ
        if (
            !outfitDetail.hidden &&
            viewedOutfitId !== null &&
            hasLoadedItems &&
            !isLoadingItems
        ) {
            renderOutfitDetail();
        }

    } catch (error) {
        console.error(
            "Ошибка отображения образов:",
            error
        );

        outfitsList.replaceChildren();

        outfitsEmptyState.hidden = true;

        outfitsError.textContent =
            "Не удалось отобразить образы. " +
            "Попробуйте перезагрузить приложение.";
    }
}


// Загружает образы из IndexedDB
async function loadOutfits() {
    if (
        !isDatabaseReady ||
        isLoadingOutfits ||
        isSavingOutfit
    ) {
        return;
    }

    isLoadingOutfits = true;

    outfitsLoadError = "";

    refreshOutfits();

    try {
        outfits = await getOutfits();

        hasLoadedOutfits = true;

    } catch (error) {
        console.error(
            "Ошибка загрузки образов:",
            error
        );

        hasLoadedOutfits = false;

        outfitsLoadError =
            "Не удалось загрузить образы. " +
            "Попробуйте перезагрузить приложение.";

    } finally {
        isLoadingOutfits = false;

        refreshOutfits();
    }
}


// Создаёт карточку выбора вещи
function createOutfitPickerCard(item) {
    const card = document.createElement("label");

    card.className =
        "card item-card outfit-picker-card";

    const name = document.createElement("span");

    name.className = "item-name";

    name.textContent = item.name;

    const checkRow = document.createElement("span");

    checkRow.className = "outfit-picker-check";

    const check = document.createElement("input");

    check.type = "checkbox";

    // Восстанавливаем только ручной выбор
    check.checked =
        selectedItemIds.has(item.id);

    check.disabled =
        isSavingOutfit;

    check.setAttribute(
        "aria-label",
        `Выбрать вещь: ${item.name}`
    );

    card.classList.toggle(
        "is-selected",
        check.checked
    );

    const label = document.createElement("span");

    label.textContent = "Выбрать";

    // Выбор и отмена выбора
    check.addEventListener(
        "change",
        () => {
            if (
                isSavingOutfit ||
                outfitForm.hidden
            ) {
                check.checked =
                    selectedItemIds.has(item.id);

                return;
            }

            if (check.checked) {
                selectedItemIds.add(item.id);

            } else {
                selectedItemIds.delete(item.id);
            }

            card.classList.toggle(
                "is-selected",
                check.checked
            );

            outfitFormError.textContent = "";

            updateOutfitControls();
        }
    );

    checkRow.append(
        check,
        label
    );

    card.append(
        createOutfitPhoto(item, true),
        name,
        checkRow
    );

    return card;
}


// Отображает все вещи для создания образа
function renderOutfitPicker() {
    const fragment =
        document.createDocumentFragment();

    // Фильтр гардероба не используется
    for (const category of categories) {
        const categoryItems = items.filter(
            (item) =>
                item.category === category.value
        );

        // Не показываем пустые категории
        if (categoryItems.length === 0) {
            continue;
        }

        const section =
            document.createElement("section");

        section.className = "item-category";

        const title =
            document.createElement("h3");

        title.className = "item-name";

        title.id =
            `outfit-category-${category.value}`;

        title.textContent =
            category.label;

        section.setAttribute(
            "aria-labelledby",
            title.id
        );

        const grid =
            document.createElement("div");

        grid.className = "items-grid";

        // Можно выбрать любое количество вещей
        for (const item of categoryItems) {
            const card =
                createOutfitPickerCard(item);

            grid.append(card);
        }

        section.append(
            title,
            grid
        );

        fragment.append(section);
    }

    outfitPicker.replaceChildren(
        fragment
    );

    updateOutfitControls();
}


// Полностью очищает форму образа
function resetOutfitForm() {
    outfitForm.reset();

    selectedItemIds.clear();

    outfitPicker.replaceChildren();

    outfitFormError.textContent = "";

    outfitSaveMessage.textContent = "";

    updateOutfitControls();
}


// Открывает создание образа
function openOutfitForm() {
    if (
        !canCreateOutfit() ||
        !outfitForm.hidden ||
        !outfitDetail.hidden
    ) {
        return;
    }

    // Начинаем с пустого названия и выбора
    resetOutfitForm();

    outfitsMessage.textContent = "";

    outfitsContent.hidden = true;

    outfitForm.hidden = false;

    addOutfitButton.setAttribute(
        "aria-expanded",
        "true"
    );

    renderOutfitPicker();

    window.scrollTo(0, 0);

    outfitFormTitle.focus();
}


// Закрывает создание образа
function closeOutfitForm() {
    outfitForm.hidden = true;

    outfitsContent.hidden = false;

    addOutfitButton.setAttribute(
        "aria-expanded",
        "false"
    );

    resetOutfitForm();
}


// Блокирует форму при сохранении образа
function setOutfitSavingState(saving) {
    isSavingOutfit = saving;

    outfitFormFields.disabled = saving;

    cancelOutfitButton.disabled = saving;

    saveOutfitButton.textContent =
        saving
            ? "Сохранение…"
            : "Сохранить образ";

    outfitSaveMessage.textContent =
        saving
            ? "Сохранение…"
            : "";

    updateNavigationControls();

    updateOutfitControls();
}


// Сохраняет образ
async function handleOutfitSubmit(event) {
    event.preventDefault();

    // Защита от повторной отправки
    if (
        !canCreateOutfit() ||
        outfitForm.hidden
    ) {
        return;
    }

    const name = outfitNameInput.value.trim();

    const itemIds = Array.from(selectedItemIds);

    outfitFormError.textContent = "";

    // Проверяем название
    if (!name) {
        outfitFormError.textContent =
            "Введите название образа.";

        outfitNameInput.focus();

        return;
    }

    // Проверяем количество вещей
    if (itemIds.length === 0) {
        outfitFormError.textContent =
            "Выберите хотя бы одну вещь.";

        return;
    }

    // Проверяем существование выбранных вещей
    const existingIds = new Set(
        items.map(
            (item) => item.id
        )
    );

    const allItemsExist =
        itemIds.every(
            (id) => existingIds.has(id)
        );

    if (!allItemsExist) {
        outfitFormError.textContent =
            "Некоторые выбранные вещи отсутствуют. " +
            "Отмените выбор и попробуйте ещё раз.";

        return;
    }

    setOutfitSavingState(true);

    let savedOutfit;

    try {
        // Сохраняем только название и ID вещей
        savedOutfit = await addOutfit({
            name,
            itemIds
        });

    } catch (error) {
        console.error(
            "Ошибка сохранения образа:",
            error
        );

        outfitFormError.textContent =
            "Не удалось сохранить образ. " +
            "Попробуйте ещё раз.";

        // Название и выбор остаются
        setOutfitSavingState(false);

        return;
    }

    // Запись подтверждена базой
    // Сразу закрываем форму
    outfitForm.hidden = true;

    outfitsContent.hidden = false;

    addOutfitButton.setAttribute(
        "aria-expanded",
        "false"
    );

    try {
        // Добавляем подтверждённую запись
        outfits.push(savedOutfit);

        closeOutfitForm();

        outfitsMessage.textContent =
            "Образ создан";

        refreshOutfits();

    } catch (error) {
        console.error(
            "Ошибка обновления списка образов:",
            error
        );

        outfitsMessage.textContent =
            "Образ создан";

        outfitsError.textContent =
            "Образ сохранён, но не удалось обновить список. " +
            "Перезагрузите приложение.";

        hasLoadedOutfits = false;

        outfitsLoadError =
            outfitsError.textContent;

    } finally {
        setOutfitSavingState(false);
    }

    window.scrollTo(0, 0);

    addOutfitButton.focus();
}


// Отображает все вещи выбранного образа
function renderOutfitDetail() {
    const outfit = outfits.find(
        (record) =>
            record.id === viewedOutfitId
    );

    outfitDetailItems.replaceChildren();

    if (!outfit) {
        outfitDetailTitle.textContent =
            "Образ не найден";

        return;
    }

    outfitDetailTitle.textContent =
        outfit.name;

    // Используем актуальные данные вещей
    const itemsById = new Map(
        items.map(
            (item) => [
                item.id,
                item
            ]
        )
    );

    const fragment =
        document.createDocumentFragment();

    for (const id of outfit.itemIds) {
        const item = itemsById.get(id);

        const card =
            document.createElement("article");

        card.className = "card item-card";

        const name =
            document.createElement("h3");

        name.className = "item-name";

        name.textContent =
            item
                ? item.name
                : "Вещь отсутствует в гардеробе";

        card.append(
            createOutfitPhoto(item, true),
            name
        );

        fragment.append(card);
    }

    outfitDetailItems.append(
        fragment
    );
}


// Открывает сохранённый образ
function openOutfitDetail(id) {
    if (
        isSavingOutfit ||
        !hasLoadedItems ||
        isLoadingItems ||
        !hasLoadedOutfits ||
        !outfitForm.hidden
    ) {
        return;
    }

    viewedOutfitId = id;

    outfitsContent.hidden = true;

    outfitDetail.hidden = false;

    renderOutfitDetail();

    window.scrollTo(0, 0);

    outfitDetailTitle.focus();
}


// Закрывает просмотр образа
function closeOutfitDetail() {
    viewedOutfitId = null;

    outfitDetail.hidden = true;

    outfitDetailItems.replaceChildren();

    outfitDetailTitle.textContent = "";

    outfitsContent.hidden = false;
}


// Инициализирует приложение
async function initializeApp() {
    addItemButton.disabled = true;

    addOutfitButton.disabled = true;

    try {
        await initDB();

    } catch (error) {
        console.error(
            "Ошибка инициализации базы данных:",
            error
        );

        isDatabaseReady = false;

        itemsLoadError =
            "Не удалось открыть базу данных. " +
            "Попробуйте перезагрузить приложение.";

        // Ошибки независимых разделов
        countersLoadError =
            itemsLoadError;

        outfitsLoadError =
            itemsLoadError;

        countersError.textContent =
            countersLoadError;

        refreshOutfits();

        renderCounters();

        renderItems();

        updateItemsControls();

        return;
    }

    isDatabaseReady = true;

    // Независимая загрузка трёх разделов
    await Promise.all([
        loadItems(),
        loadCounters(),
        loadOutfits()
    ]);
}


// Обработчики навигации
navButtons.forEach((button) => {
    button.addEventListener(
        "click",
        () => {
            showScreen(
                button.dataset.screen
            );
        }
    );
});


// Обработчики фильтров
filterButtons.forEach((button) => {
    button.addEventListener(
        "click",
        () => {
            setActiveFilter(
                button.dataset.filter
            );
        }
    );
});


// Открытие формы вещи
addItemButton.addEventListener(
    "click",
    openItemForm
);


// Выбор фотографии
photoInput.addEventListener(
    "change",
    handlePhotoChange
);


// Отмена добавления вещи
cancelItemButton.addEventListener(
    "click",
    () => {
        if (isSaving) {
            return;
        }

        closeItemForm();

        window.scrollTo(0, 0);

        addItemButton.focus();
    }
);


// Сохранение вещи
itemForm.addEventListener(
    "submit",
    handleItemSubmit
);


// Изменение количества
counterButtons.forEach((button) => {
    button.addEventListener(
        "click",
        () => {
            handleCounterAdjustment(button);
        }
    );
});


// Перенос в грязные
moveButtons.forEach((button) => {
    button.addEventListener(
        "click",
        () => {
            handleCounterMove(button);
        }
    );
});


// Общая стирка
washAllButton.addEventListener(
    "click",
    handleWashAll
);


// Открытие создания образа
addOutfitButton.addEventListener(
    "click",
    openOutfitForm
);


// Изменение названия образа
outfitNameInput.addEventListener(
    "input",
    () => {
        outfitFormError.textContent = "";

        updateOutfitControls();
    }
);


// Сохранение образа
outfitForm.addEventListener(
    "submit",
    handleOutfitSubmit
);


// Отмена создания образа
cancelOutfitButton.addEventListener(
    "click",
    () => {
        if (isSavingOutfit) {
            return;
        }

        closeOutfitForm();

        window.scrollTo(0, 0);

        addOutfitButton.focus();
    }
);


// Возвращение к списку образов
backToOutfitsButton.addEventListener(
    "click",
    () => {
        closeOutfitDetail();

        window.scrollTo(0, 0);

        addOutfitButton.focus();
    }
);


// Начальное состояние
showScreen("items");

setActiveFilter("all");

renderCounters();


// Инициализация базы данных
initializeApp();


// Регистрация Service Worker после загрузки страницы
if ("serviceWorker" in navigator) {

    const registerServiceWorker = () => {
        navigator.serviceWorker.register("./sw.js")
            .catch((error) => {
                console.error(
                    "Ошибка регистрации Service Worker:",
                    error
                );
            });
    };

    if (document.readyState === "complete") {
        registerServiceWorker();

    } else {
        window.addEventListener(
            "load",
            registerServiceWorker,
            { once: true }
        );
    }
}
