export interface GiftData {
    id: number
    name: string
    price: number
    description: string
  }
  
  export const gifts: GiftData[] = [
    { id: 1, name: "Сердечко", price: 5, description: "Маленький знак внимания" },
    { id: 2, name: "Цветок", price: 10, description: "Нежный цветок" },
    { id: 3, name: "Кексик", price: 15, description: "Сладкий сюрприз" },
    { id: 4, name: "Воздушный шар", price: 20, description: "Праздничное настроение" },
    { id: 5, name: "Звезда", price: 25, description: "Сияющая звезда" },
    { id: 6, name: "Подарок", price: 30, description: "Загадочный подарок" },
    { id: 7, name: "Корона", price: 50, description: "Королевский подарок" },
    { id: 8, name: "Роза", price: 75, description: "Красная роза" },
    { id: 9, name: "Бриллиант", price: 100, description: "Драгоценный камень" },
    { id: 10, name: "Шампанское", price: 150, description: "Игристое шампанское" },
    { id: 11, name: "Колесо фортуны", price: 200, description: "Удача на твоей стороне" },
    { id: 12, name: "Фейерверк", price: 250, description: "Праздничный фейерверк" },
    { id: 13, name: "Радуга", price: 300, description: "Яркая радуга" },
    { id: 14, name: "Круассан", price: 350, description: "Круассан с начинкой, или без..." },
    { id: 15, name: "Волшебная палочка", price: 400, description: "Магический подарок" },
    { id: 16, name: "Кубок", price: 500, description: "Победный кубок" },
    { id: 17, name: "Самолет", price: 600, description: "Путешествие мечты" },
    { id: 18, name: "Яхта", price: 750, description: "Роскошная яхта" },
    { id: 19, name: "Замок", price: 900, description: "Величественный замок" },
    { id: 20, name: "Остров", price: 1100, description: "Собственный остров" },
    { id: 21, name: "Галактика", price: 1300, description: "Целая галактика" },
    { id: 22, name: "Вулкан", price: 1500, description: "Огненный вулкан" },
    { id: 23, name: "Айсберг", price: 1700, description: "Ледяной гигант" },
    { id: 24, name: "Комета", price: 1900, description: "Небесная комета" },
    { id: 25, name: "Черная дыра", price: 2100, description: "Космическая загадка" },
    { id: 26, name: "Феникс", price: 2300, description: "Мифическая птица" },
    { id: 27, name: "Дракон", price: 2500, description: "Легендарный дракон" },
    { id: 28, name: "Единорог", price: 2800, description: "Волшебный единорог" },
    { id: 29, name: "Шляпа", price: 3200, description: "Шляпа ведьмы" },
    { id: 30, name: "Вечность", price: 3471, description: "Дар вечности" },
  ]

  export const allGifts: GiftData[] = [
    { id: 1, name: "Сердечко", price: 5, description: "Маленький знак внимания" },
    { id: 2, name: "Цветок", price: 10, description: "Нежный цветок" },
    { id: 3, name: "Кексик", price: 15, description: "Сладкий сюрприз" },
    { id: 4, name: "Воздушный шар", price: 20, description: "Праздничное настроение" },
    { id: 5, name: "Звезда", price: 25, description: "Сияющая звезда" },
    { id: 6, name: "Подарок", price: 30, description: "Загадочный подарок" },
    { id: 7, name: "Корона", price: 50, description: "Королевский подарок" },
    { id: 8, name: "Роза", price: 75, description: "Красная роза" },
    { id: 9, name: "Бриллиант", price: 100, description: "Драгоценный камень" },
    { id: 10, name: "Шампанское", price: 150, description: "Игристое шампанское" },
    { id: 11, name: "Колесо фортуны", price: 200, description: "Удача на твоей стороне" },
    { id: 12, name: "Фейерверк", price: 250, description: "Праздничный фейерверк" },
    { id: 13, name: "Радуга", price: 300, description: "Яркая радуга" },
    { id: 14, name: "Круассан", price: 350, description: "Круассан с начинкой, или без..." },
    { id: 15, name: "Волшебная палочка", price: 400, description: "Магический подарок" },
    { id: 16, name: "Кубок", price: 500, description: "Победный кубок" },
    { id: 17, name: "Самолет", price: 600, description: "Путешествие мечты" },
    { id: 18, name: "Яхта", price: 750, description: "Роскошная яхта" },
    { id: 19, name: "Замок", price: 900, description: "Величественный замок" },
    { id: 20, name: "Остров", price: 1100, description: "Собственный остров" },
    { id: 21, name: "Галактика", price: 1300, description: "Целая галактика" },
    { id: 22, name: "Вулкан", price: 1500, description: "Огненный вулкан" },
    { id: 23, name: "Айсберг", price: 1700, description: "Ледяной гигант" },
    { id: 24, name: "Комета", price: 1900, description: "Небесная комета" },
    { id: 25, name: "Черная дыра", price: 2100, description: "Космическая загадка" },
    { id: 26, name: "Феникс", price: 2300, description: "Мифическая птица" },
    { id: 27, name: "Дракон", price: 2500, description: "Легендарный дракон" },
    { id: 28, name: "Единорог", price: 2800, description: "Волшебный единорог" },
    { id: 29, name: "Шляпа", price: 3200, description: "Шляпа ведьмы" },
    { id: 30, name: "Вечность", price: 3471, description: "Дар вечности" },

    { id: 31, name: "Снежинка", price: 500, description: "Космическая загадка" },
    { id: 32, name: "Снеговик", price: 2500, description: "Мифическая птица" },
    { id: 33, name: "Санта Клаус", price: 2700, description: "Легендарный дракон" },
    { id: 34, name: "Рождественская ёлка", price: 4100, description: "Волшебный единорог" },
    { id: 36, name: "Новый год!", price: 5672, description: "Шляпа ведьмы" },
  ]
  
  export function getGiftById(id: number): GiftData | undefined {
    return allGifts.find(gift => gift.id === id)
  }

  export function getAllGiftById(id: number): GiftData | undefined {
    return allGifts.find(gift => gift.id === id)
  }
  
  export function getGiftImagePath(giftId: number): string {
    return `/assets/gifts/${giftId}.png`
  }