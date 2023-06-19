// Copyright 2022-2023 The Memphis.dev Authors
// Licensed under the Memphis Business Source License 1.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// Changed License: [Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0), as published by the Apache Foundation.
//
// https://github.com/memphisdev/memphis/blob/master/LICENSE
//
// Additional Use Grant: You may make use of the Licensed Work (i) only as part of your own product or service, provided it is not a message broker or a message queue product or service; and (ii) provided that you do not use, provide, distribute, or make available the Licensed Work as a Service.
// A "Service" is a commercial offering, product, hosted, or managed service, that allows third parties (other than your own employees and contractors acting on your behalf) to access and/or use the Licensed Work or a substantial set of the features or functionality of the Licensed Work to third parties as a software-as-a-service, platform-as-a-service, infrastructure-as-a-service or other similar services that compete with Licensor products or services.

import './style.scss';

import React, { useEffect, useContext, useState } from 'react';

import { LOCAL_STORAGE_AVATAR_ID, LOCAL_STORAGE_USER_TYPE } from '../../const/localStorageConsts';
import deleteWrapperIcon from '../../assets/images/deleteWrapperIcon.svg';
import { ApiEndpoints } from '../../const/apiEndpoints';
import { isCloud } from '../../services/valueConvertor';
import { httpRequest } from '../../services/http';
import AuthService from '../../services/auth';
import Button from '../../components/button';
import { Context } from '../../hooks/store';
import Modal from '../../components/modal';
import { Checkbox, Divider } from 'antd';
import pathDomains from '../../router';
import ImgUploader from './imgUploader';
import DeleteItemsModal from '../../components/deleteItemsModal';

function Profile() {
    const [userType, setUserType] = useState('');
    const [state, dispatch] = useContext(Context);
    const [avatar, setAvatar] = useState(1);
    const [open, modalFlip] = useState(false);
    const [checkboxdeleteAccount, setCheckboxdeleteAccount] = useState(false);
    const [delateLoader, setDelateLoader] = useState(false);

    useEffect(() => {
        dispatch({ type: 'SET_ROUTE', payload: 'profile' });
        setUserType(localStorage.getItem(LOCAL_STORAGE_USER_TYPE));
        setAvatar(Number(localStorage.getItem(LOCAL_STORAGE_AVATAR_ID)) || state?.userData?.avatar_id);
    }, []);

    const removeMyUser = async () => {
        setDelateLoader(true);
        try {
            await httpRequest('DELETE', `${ApiEndpoints.REMOVE_MY_UER}`);
            modalFlip(false);
            AuthService.logout();
        } catch (err) {
            setDelateLoader(false);
            return;
        }
    };

    const editAvatar = async (avatarId) => {
        try {
            const data = await httpRequest('PUT', `${ApiEndpoints.EDIT_AVATAR}`, { avatar_id: avatarId });
            setAvatar(data.avatar_id);
            localStorage.setItem(LOCAL_STORAGE_AVATAR_ID, data.avatar_id);
            dispatch({ type: 'SET_AVATAR_ID', payload: data.avatar_id });
        } catch (err) {
            return;
        }
    };

    return (
        <div className="profile-page">
            <div className="profile-container">
                <div className="header-preferences">
                    <p className="main-header">Profile</p>
                    <p className="memphis-label">Modify your profile information and preferences</p>
                </div>
                <div className="avatar-section">
                    <p className="title">Avatar</p>
                    <div className="avatar-images">
                        {localStorage.getItem('profile_pic') && (
                            <div className={'avatar-img selected'}>
                                <img src={localStorage.getItem('profile_pic')} width={35} height={35} alt="avater" />
                            </div>
                        )}
                        {Array.from(Array(8).keys()).map((item, index) => {
                            return (
                                <div key={index} className={avatar === item + 1 ? 'avatar-img selected' : 'avatar-img'} onClick={() => editAvatar(item + 1)}>
                                    <img src={require(`../../assets/images/bots/avatar${item + 1}.svg`)} alt="avater" />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <ImgUploader />
                <Divider />
                <div className="delete-account-section">
                    <p className="title">{isCloud() ? 'Delete your organization' : 'Delete your account'}</p>
                    {isCloud() ? (
                        <label className="delete-account-description">
                            When you delete your organization, you will lose access to Memphis,
                            <br />
                            and your entire organization data will be permanently deleted. You can cancel the deletion for 14 days.
                        </label>
                    ) : (
                        <label className="delete-account-description">
                            When you delete your account, you will lose access to Memphis,
                            <br />
                            and your profile will be permanently deleted. You can cancel the deletion for 14 days.
                        </label>
                    )}

                    <div className="delete-account-checkbox">
                        <Checkbox
                            checked={checkboxdeleteAccount}
                            disabled={isCloud() ? userType !== 'root' : userType === 'root'}
                            onChange={() => setCheckboxdeleteAccount(!checkboxdeleteAccount)}
                            name="delete-account"
                        />
                        <p
                            className={(isCloud() && userType !== 'root') || (!isCloud() && userType === 'root') ? 'disabled' : ''}
                            onClick={() =>
                                ((isCloud() && userType === 'root') || (!isCloud() && userType !== 'root')) && setCheckboxdeleteAccount(!checkboxdeleteAccount)
                            }
                        >
                            Confirm that I want to delete my {isCloud() ? 'organization' : 'account'}.
                        </p>
                    </div>
                    <Button
                        className="modal-btn"
                        width="200px"
                        height="36px"
                        placeholder="Delete Account"
                        colorType="white"
                        radiusType="circle"
                        backgroundColorType="red"
                        border="none"
                        boxShadowsType="red"
                        fontSize="14px"
                        fontWeight="600"
                        aria-haspopup="true"
                        disabled={!checkboxdeleteAccount}
                        onClick={() => modalFlip(true)}
                    />
                </div>
                <Modal
                    header={<img src={deleteWrapperIcon} alt="deleteWrapperIcon" />}
                    width="520px"
                    height="240px"
                    displayButtons={false}
                    clickOutside={() => modalFlip(false)}
                    open={open}
                >
                    <DeleteItemsModal
                        title={isCloud() ? 'Delete your organization' : 'Delete your account'}
                        desc={
                            <>
                                Are you sure you want to delete {isCloud() ? 'your organization' : 'your account'}?
                                <br />
                                Please note that this action is irreversible.
                            </>
                        }
                        buttontxt={<>I understand, delete my {isCloud() ? 'organization' : 'account'}</>}
                        handleDeleteSelected={() => removeMyUser()}
                        loader={delateLoader}
                    />
                    <br />
                </Modal>
            </div>
        </div>
    );
}

export default Profile;
