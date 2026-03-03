import RM from "../helpers/random.function";
import Random, { } from "../helpers/random.function";

export const TD = {
TEST_NAME: 'Victor',
COUNTRY: 'Ukraine',
TitleProduct: 'Product',
TitleGeneralStore: 'General Store',
RandomName: RM.generateRandomName,
ConstantRandomName: RM.generateHumanName(),
RandomCountry: RM.generateCountry(),
FakerName: RM.generateFakerName(),
FakerCountry: RM.generateFakerCountry()
} as const;