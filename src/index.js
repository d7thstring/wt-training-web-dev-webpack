import 'babel-polyfill';

import {userStore} from './user/user-store';
import {User} from './user/user';
import {UserFormComponent} from './user/user-form.component';
import {UserListComponent} from './user/user-list.component';
import {BookListComponent} from './book/book-list.component';

export const main = () => {

    userStore.addUser(new User('Foo', 'BAR'));
    userStore.addUser(new User('John', 'DOE'));

    customElements.define('wt-book-list', BookListComponent);
    customElements.define('wt-user-form', UserFormComponent);
    customElements.define('wt-user-list', UserListComponent);

};

document.addEventListener('DOMContentLoaded', () => main());
