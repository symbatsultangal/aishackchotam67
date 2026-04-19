export type OrderFieldDef = {
  name: string;
  question: string;
  type: "string" | "date" | "number";
};

export type OrderTemplate = {
  key: string;
  title: string;
  description: string;
  requiredFields: OrderFieldDef[];
};

export const ORDER_TEMPLATES: OrderTemplate[] = [
  {
    key: "leave_request",
    title: "Приказ об отпуске",
    description: "Оформление очередного или внеочередного отпуска сотрудника",
    requiredFields: [
      { name: "employeeName", question: "ФИО сотрудника", type: "string" },
      { name: "position", question: "Должность сотрудника", type: "string" },
      { name: "startDate", question: "Дата начала отпуска (ГГГГ-ММ-ДД)", type: "date" },
      { name: "durationDays", question: "Количество календарных дней отпуска", type: "number" },
      { name: "leaveType", question: "Тип отпуска (очередной / внеочередной / без содержания)", type: "string" },
    ],
  },
  {
    key: "transfer_teacher",
    title: "Перевод сотрудника",
    description: "Внутренний перевод на другую должность или в другое подразделение",
    requiredFields: [
      { name: "employeeName", question: "ФИО сотрудника", type: "string" },
      { name: "currentPosition", question: "Текущая должность", type: "string" },
      { name: "newPosition", question: "Новая должность / подразделение", type: "string" },
      { name: "effectiveDate", question: "Дата перевода (ГГГГ-ММ-ДД)", type: "date" },
      { name: "reason", question: "Основание для перевода", type: "string" },
    ],
  },
  {
    key: "inventory_decommission",
    title: "Списание имущества",
    description: "Списание материальных ценностей школы с балансового учёта",
    requiredFields: [
      { name: "itemName", question: "Наименование имущества", type: "string" },
      { name: "inventoryNumber", question: "Инвентарный номер", type: "string" },
      { name: "reason", question: "Причина списания (износ / поломка / утеря)", type: "string" },
      { name: "responsiblePerson", question: "ФИО материально ответственного лица", type: "string" },
      { name: "commissionMembers", question: "Состав комиссии (через запятую)", type: "string" },
    ],
  },
  {
    key: "disciplinary_action",
    title: "Дисциплинарное взыскание",
    description: "Оформление замечания, выговора или предупреждения сотруднику",
    requiredFields: [
      { name: "employeeName", question: "ФИО сотрудника", type: "string" },
      { name: "position", question: "Должность", type: "string" },
      { name: "violationDescription", question: "Описание нарушения", type: "string" },
      { name: "actionType", question: "Вид взыскания (замечание / выговор / предупреждение)", type: "string" },
      { name: "violationDate", question: "Дата нарушения (ГГГГ-ММ-ДД)", type: "date" },
    ],
  },
  {
    key: "enrollment",
    title: "Зачисление ученика",
    description: "Приказ о зачислении нового ученика в школу",
    requiredFields: [
      { name: "studentName", question: "ФИО ученика", type: "string" },
      { name: "dateOfBirth", question: "Дата рождения (ГГГГ-ММ-ДД)", type: "date" },
      { name: "className", question: "Класс зачисления", type: "string" },
      { name: "enrollmentDate", question: "Дата зачисления (ГГГГ-ММ-ДД)", type: "date" },
      { name: "parentName", question: "ФИО родителя / законного представителя", type: "string" },
    ],
  },
];
