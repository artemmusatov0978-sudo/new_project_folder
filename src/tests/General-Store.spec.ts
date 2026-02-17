import { expect } from '@wdio/globals';
import { main } from 'appium';
import { SchemaNameConflictError } from 'appium/build/lib/schema/schema';
import { describe, it } from 'mocha';

describe('General Store', () => {
  it ('Splash_scrin_test', async () => {

    const nameBucket = await $(
      'android=new UiSelector().resourceId("com.androidsample.generalstore:id/splashscreen")'
    );
    await nameBucket.waitForDisplayed({ timeout: 15000 });
  })

  it ('Title_text_test', async () => {
    const nameTitle = await $(
      'android=new UiSelector().resourceId("com.androidsample.generalstore:id/toolbar_title")'
    );
    await nameTitle.waitForDisplayed({timeout: 15000});
    await expect(nameTitle).toHaveText('General Store')
  })
  it ('Image_check_test', async () => {
    const nameImageCheckMainScreen = await $('android=new UiSelector().className("android.widget.ImageView")');
    await nameImageCheckMainScreen.waitForDisplayed({timeout:15000});
    await expect(nameImageCheckMainScreen).toBeDisplayed();
  })
  it.only ('Menu_check_test', async () => {
    const nameMainScreenDropDown = await $('android=new UiSelector().resourceId("android:id/text1")');
    //const countryUA = await $('android=new UiScrollable(new UiSelector().scrollable(true)).flingForward().scrollIntoView(new UiSelector().text("Ukraine"))');
    //const countryUA = await $('android=new UiScrollable(new UiSelector().scrollable(true))' +'.scrollTextIntoView("Ukraine")');
    //const countryUA = await $('android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).setMaxSearchSwipes(99).scrollIntoView(new UiSelector().text("Ukraine").instance(0))');
    await nameMainScreenDropDown.waitForDisplayed({timeout: 15000}); 
    await nameMainScreenDropDown.click();
    let countryUA = null;
  for (let i = 0; i < 30; i++) {
    try {
      countryUA = await $('android=new UiSelector().text("Ukraine")');
      if (await countryUA.isDisplayed()) break;
    } catch (e) {}
    await driver.execute('mobile: swipeGesture', {
      left: 0, top: 300, width: 1080, height: 1500,
      direction: 'up',
      percent: 1,
      speed: 5000  
    });
  }
    if (!countryUA) throw new Error('Ukraine не знайдено після скролу');
    await countryUA.waitForDisplayed({timeout:180000});
    await countryUA.click()
    await expect(nameMainScreenDropDown).toHaveText('Ukraine');
  }
  )
  it ('MainScreenRadioButtonMale', async () => {
    const MainScreenRadioButtonMale = await $('android=new UiSelector().resourceId("com.androidsample.generalstore:id/radioMale")');
    const MainScreenRadioButtonFemale = await $('android=new UiSelector().resourceId("com.androidsample.generalstore:id/radioFemale")');
    await MainScreenRadioButtonMale.waitForDisplayed({timeout:15000});
    await driver.pause(500)
    await MainScreenRadioButtonMale.click();
    const MainScreenRadioButtonFemale_IsChecked = await MainScreenRadioButtonFemale.getAttribute('checked');
    const MainScreenRadioButtonMale_IsChecked = await MainScreenRadioButtonMale.getAttribute('checked');
    await expect(MainScreenRadioButtonFemale_IsChecked).toEqual('false');
    await expect(MainScreenRadioButtonMale_IsChecked).toEqual('true');
  }
  )
  it ('MainScreenRadioButtonFemale', async () => {
    const MainScreenRadioButtonMale = await $('android=new UiSelector().resourceId("com.androidsample.generalstore:id/radioMale")');
    const MainScreenRadioButtonFemale = await $('android=new UiSelector().resourceId("com.androidsample.generalstore:id/radioFemale")');
    await MainScreenRadioButtonMale.waitForDisplayed({timeout:15000});
    await MainScreenRadioButtonFemale.click();
    await driver.pause(500)
    const MainScreenRadioButtonFemale_IsChecked = await MainScreenRadioButtonFemale.getAttribute('checked');
    const MainScreenRadioButtonMale_IsChecked = await MainScreenRadioButtonMale.getAttribute('checked');
    await expect(MainScreenRadioButtonFemale_IsChecked).toEqual('true');
    await expect(MainScreenRadioButtonMale_IsChecked).toEqual('false');
  }
  )
it ('MainScreenInputField', async () => {
    const MainScreenInputField = await $('android=new UiSelector().resourceId("com.androidsample.generalstore:id/nameField")')
    await MainScreenInputField.waitForDisplayed({timeout:15000});
    await MainScreenInputField.setValue('Victor');
    await expect(MainScreenInputField).toHaveText('Victor')
    })
it ('MainScreenShopButton', async () => {
    const MainScreenShopButton = await $('android=new UiSelector().resourceId("com.androidsample.generalstore:id/btnLetsShop")');
    const ShopTitleText = await $('android= new UiSelector().resourceId("com.androidsample.generalstore:id/toolbar_title")');
    await MainScreenShopButton.waitForDisplayed({timeout:15000});
    await MainScreenShopButton.click()
    await expect(ShopTitleText).toHaveText('Products')
    })
})