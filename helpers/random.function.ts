import { faker } from "@faker-js/faker/locale/uk";


class RM {

 static generateHumanName(): string {
  const names = ['Ivan', 'Olena', 'Andrii', 'Sofia', 'Mykola', 'Anna'];
  const randomIndex = Math.floor(Math.random() * names.length);
  return names[randomIndex] + Math.floor(Math.random() * 1000);
}
static generateRandomName(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
 
  return result;
}
static generateCountry(): string {
  const country = ['Ukraine', 'Albania', 'Algeria', 'Bolivia']
  const randomIndex = Math.floor(Math.random() * country.length);
  return country[randomIndex] 
}

static generateFakerName(): string {
  return faker.person.firstName();
}
static generateFakerCountry(): string {
  return faker.location.country.name
}

} export default RM