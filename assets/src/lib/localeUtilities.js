//this class will be used to manage local (language) storage
class LocaleUtilities {
    //add constructor to set default local
    constructor() {
        //check if local is set in local storage
        if (!localStorage.getItem('local')) {
            //if not set local to default
            this.setDefaultLocal();
        }
    }
    //at starting point we need methods to set local , get local

    static async alertMessage() {
        // alert('LocaleUtilities: alertMessage');
    }

    static setLanguage(language) {
        localStorage.setItem('language', language);
    }

    static getLanguage() {
        return localStorage.getItem('language');
    }

    //and set local to default
    static setLocal(local) {
        localStorage.setItem('local', local);
    }
    static getLocal() {
        return localStorage.getItem('local');
    }
    static setDefaultLocal() {
        localStorage.setItem('local', 'en');
    }
    static getDefaultLocal() {
        return 'en';
    }
    //this method will be used to set local to default
}
export {
    LocaleUtilities
} ;
