/**
 * منيو بيتزا قوطة — بيانات معاينة
 * ---------------------------------------------------------------------------
 * ⚠️ كل الأصناف والأسعار هنا "تجريبية" لأن المنيو الرسمي لم يُقدَّم.
 * لا تُنشر هذه البيانات للعملاء كأسعار مؤكدة.
 *
 * طريقة تعديل المنيو:
 * - عدّل اسم أي صنف ووصفه وسعره من مصفوفة items.
 * - السعر بالجنيه المصري ويُكتب رقمًا فقط (مثال: 145).
 * - ضع ملفات الصور في assets/images واستخدم مسارها في image.
 * - لإضافة صنف: انسخ أي عنصر وعدّل id و category وبياناته.
 * - الفئات المتاحة حاليًا: pizza / shawarma / fast-food / drinks.
 * - بعد اعتماد المنيو والأسعار، عدّل إعدادات menu في ملف config.js.
 */
window.QOUTA_MENU = {
  categories: [
    { id: "all", name: "كل المنيو" },
    { id: "pizza", name: "البيتزا" },
    { id: "shawarma", name: "الشاورما" },
    { id: "fast-food", name: "المأكولات السريعة" },
    { id: "drinks", name: "المشروبات" }
  ],

  addons: [
    {
      id: "extra-cheese",
      name: "جبنة إضافية",
      price: 20,
      categories: ["pizza"]
    },
    {
      id: "extra-sauce",
      name: "صوص إضافي",
      price: 10,
      categories: ["pizza", "shawarma", "fast-food"]
    },
    {
      id: "jalapeno",
      name: "هالبينو",
      price: 10,
      categories: ["pizza", "shawarma"]
    }
  ],

  items: [
    {
      id: "margherita",
      category: "pizza",
      name: "بيتزا مارجريتا",
      description: "صوص طماطم، موتزاريلا وريحان على قاعدة كلاسيكية.",
      price: 145,
      image: "assets/images/menu-margherita.webp",
      imageAlt: "بيتزا مارجريتا بالجبن والريحان",
      addonIds: ["extra-cheese", "extra-sauce", "jalapeno"]
    },
    {
      id: "cheese-pizza",
      category: "pizza",
      name: "بيتزا الجبن",
      description: "ميكس أجبان وموتزاريلا مع طماطم شيري ورشة أعشاب.",
      price: 175,
      image: "assets/images/menu-cheese-pizza.webp",
      imageAlt: "بيتزا ميكس أجبان مع طماطم شيري",
      addonIds: ["extra-cheese", "extra-sauce", "jalapeno"]
    },
    {
      id: "chicken-pizza",
      category: "pizza",
      name: "بيتزا دجاج",
      description: "قطع دجاج، بصل أحمر، صوص باربكيو ولمسة كزبرة.",
      price: 210,
      image: "assets/images/menu-chicken-pizza.webp",
      imageAlt: "بيتزا دجاج بصوص باربكيو",
      addonIds: ["extra-cheese", "extra-sauce", "jalapeno"]
    },
    {
      id: "veggie-pizza",
      category: "pizza",
      name: "بيتزا خضار",
      description: "فطر، طماطم شيري وريحان على قاعدة من الجبن.",
      price: 185,
      image: "assets/images/menu-veggie-pizza.webp",
      imageAlt: "بيتزا خضار بالفطر والطماطم",
      addonIds: ["extra-cheese", "extra-sauce", "jalapeno"]
    },
    {
      id: "chicken-shawarma",
      category: "shawarma",
      name: "شاورما دجاج",
      description: "شاورما دجاج متبلة مع خضار وصوص داخل خبز محمّص.",
      price: 95,
      image: "assets/images/menu-shawarma-chicken.webp",
      imageAlt: "ساندويتش شاورما دجاج",
      addonIds: ["extra-sauce", "jalapeno"]
    },
    {
      id: "meat-shawarma",
      category: "shawarma",
      name: "شاورما لحم",
      description: "لحم شاورما مقطّع مع بصل وخضار وصوص.",
      price: 120,
      image: "assets/images/menu-shawarma-meat.webp",
      imageAlt: "لحم شاورما مقطّع",
      addonIds: ["extra-sauce", "jalapeno"]
    },
    {
      id: "double-burger",
      category: "fast-food",
      name: "برجر دوبل",
      description: "قطعتا برجر مع جبنة وخس ومخلل وصوص.",
      price: 135,
      image: "assets/images/menu-burger.webp",
      imageAlt: "برجر دوبل بالجبنة",
      addonIds: ["extra-cheese", "extra-sauce"]
    },
    {
      id: "fries",
      category: "fast-food",
      name: "بطاطس",
      description: "بطاطس مقلية مع رشة بهارات.",
      price: 50,
      image: "assets/images/menu-fries.webp",
      imageAlt: "طبق بطاطس مقلية",
      addonIds: ["extra-sauce"]
    },
    {
      id: "chicken-wings",
      category: "fast-food",
      name: "أجنحة دجاج",
      description: "أجنحة دجاج بصوص، ومعاها صوص للتغميس.",
      price: 115,
      image: "assets/images/menu-chicken-wings.webp",
      imageAlt: "أجنحة دجاج بصوص التغميس",
      addonIds: ["extra-sauce"]
    },
    {
      id: "lemonade",
      category: "drinks",
      name: "ليموناضة",
      description: "ليمون بارد مع ثلج.",
      price: 35,
      image: "assets/images/menu-lemonade.webp",
      imageAlt: "كوب ليموناضة بالليمون",
      addonIds: []
    },
    {
      id: "orange-juice",
      category: "drinks",
      name: "عصير برتقال",
      description: "عصير برتقال منعش.",
      price: 40,
      image: "assets/images/menu-orange-juice.webp",
      imageAlt: "كوب عصير برتقال طازج",
      addonIds: []
    },
    {
      id: "watermelon-juice",
      category: "drinks",
      name: "عصير بطيخ",
      description: "عصير بطيخ بارد وخفيف.",
      price: 40,
      image: "assets/images/menu-watermelon-juice.webp",
      imageAlt: "كوب عصير بطيخ مع قطعة بطيخ",
      addonIds: []
    }
  ]
};
