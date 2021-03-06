/*
* == BSD2 LICENSE ==
* Copyright (c) 2015-2016, Tidepool Project
*
* This program is free software; you can redistribute it and/or modify it under
* the terms of the associated License, which is identical to the BSD 2-Clause
* License as published by the Open Source Initiative at opensource.org.
*
* This program is distributed in the hope that it will be useful, but WITHOUT
* ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
* FOR A PARTICULAR PURPOSE. See the License for more details.
*
* You should have received a copy of the License along with this program; if
* not, you can obtain one from Tidepool Project at tidepool.org.
* == BSD2 LICENSE ==
*/

import _ from 'lodash';
import cx from 'classnames';
import PropTypes from 'prop-types';
import React, { Component } from 'react';

import sundial from 'sundial';
import keytar from 'keytar';

import LoadingBar from './LoadingBar';
import ProgressBar from './ProgressBar';
import debugMode from '../utils/debugMode';

import styles from '../../styles/components/Upload.module.less';

const MEDTRONIC_KEYTAR_SERVICE = 'org.tidepool.uploader.medtronic.serialnumber';

export default class Upload extends Component {
  static propTypes = {
    disabled: PropTypes.bool.isRequired,
    rememberMedtronicSerialNumber: PropTypes.func.isRequired,
    // targetId is needed to remember the pump serial number.
    // It can be null when logged in user is not a data storage account
    // for example a clinic worker
    targetId: PropTypes.string,
    upload: PropTypes.object.isRequired,
    onUpload: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    readFile: PropTypes.func.isRequired,
    text: PropTypes.object.isRequired
  };

  static defaultProps = {
    text: {
      CARELINK_USERNAME: 'CareLink username',
      CARELINK_PASSWORD: 'CareLink password',
      CARELINK_DOWNLOADING: 'Downloading CareLink export...',
      MEDTRONIC_SERIAL_NUMBER: 'Pump Serial number',
      REMEMBER_SERIAL_NUMBER: 'Remember serial number',
      LABEL_UPLOAD: 'Upload',
      LABEL_IMPORT: 'Import',
      LABEL_OK: 'OK',
      LABEL_FAILED: 'Try again',
      LAST_UPLOAD: 'Last upload: ',
      DEVICE_UNKNOWN: 'Unknown device',
      UPLOAD_COMPLETE: 'Done!',
      UPLOAD_PROGRESS: 'Uploading... ',
      NOTE: 'Note:',
      FIRST_UPLOAD: 'We\'ve improved how devices upload. This upload will take \
                     longer than usual, but your future uploads will be much, \
                     much faster.'
    }
  };

  state = {
    carelinkFormIncomplete: true,
    medtronicFormIncomplete: true,
    medtronicSerialNumberValue: '',
    medtronicSerialNumberRemember: false
  };

  constructor(props) {
    super(props);

    this.populateRememberedSerialNumber();
  }

  componentWillMount() {
      // Initialize the UI state. Needed for logout/login scenarios
      this.handleReset();
   }

  populateRememberedSerialNumber() {
    keytar.getPassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId)
      .then((serialNumber) => {
        if(serialNumber) {
          this.setState({
            medtronicSerialNumberValue: serialNumber,
            medtronicSerialNumberRemember: true,
            medtronicFormIncomplete: false,
          });
          this.onCareLinkInputChange();
        }
    });
  }

  handleCareLinkUpload = () => {
    const { refs } = this;
    let options = {
      username: refs.username.value,
      password: refs.password.value
    };
    this.props.onUpload(options);
  };

  handleMedtronicUpload() {
    if (this.state.medtronicSerialNumberRemember) {
      // Only set the password if it is different
      keytar.getPassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId)
        .then((serialNumber) => {
          if (serialNumber != this.state.medtronicSerialNumberValue) {
            keytar.setPassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId,
              this.state.medtronicSerialNumberValue)
              .then(() => {
                this.props.rememberMedtronicSerialNumber();
              });
          }
        });
    }

    let options = {
      serialNumber: this.state.medtronicSerialNumberValue
    };
    this.props.onUpload(options);
  }

  handleReset = e => {
    if (e) {
      e.preventDefault();
    }
    this.setState({
      carelinkFormIncomplete: true,
      medtronicFormIncomplete: true,
      medtronicSerialNumberValue: ''
    });
    this.props.onReset();
    this.populateRememberedSerialNumber();
  };

  handleUpload = e => {
    const { upload } = this.props;
    if (e) {
      e.preventDefault();
    }

    if (_.get(upload, 'source.type', null) === 'carelink') {
      return this.handleCareLinkUpload();
    }

    if (_.get(upload, 'key', null) === 'medtronic') {
      return this.handleMedtronicUpload();
    }

    var options = {};
    this.props.onUpload(options);
  };

  onBlockModeInputChange = e => {
    const { upload } = this.props;
    let file = e.target.files[0];
    this.props.readFile(file, upload.source.extension);
  };

  onCareLinkInputChange = () => {
    const { refs } = this;
    let username = refs.username && refs.username.value;
    let password = refs.password && refs.password.value;

    if (!username || !password) {
      this.setState({carelinkFormIncomplete: true});
    }
    else {
      this.setState({carelinkFormIncomplete: false});
    }
  };

  onMedtronicSerialNumberRememberChange = e => {
    const checkbox = e.target;
    const checked = checkbox.checked;

    this.setState({
      medtronicSerialNumberRemember: checked
    });

    // Delete the stored serial number if the "Remember" box is being unchecked
    if(!checked) {
      keytar.deletePassword(MEDTRONIC_KEYTAR_SERVICE, this.props.targetId);
    }
  };

  onMedtronicSerialNumberInputChange = e => {
    const field = e.target;
    const value = field.value;
    const chars = _.split(value, '');

    // Check if input is purely numbers.
    // E.g., 123e4 is considered numeric, as is -123, but for our purposes they are not valid input.
    let isValid = _.every(chars, function(char, n) {
      return !isNaN(char);
    });

    // Don't update field input if non-numeric character is entered.
    if (!isValid) {
      return;
    }

    if (field && value) {
      if (value.length === 6) {
        this.setState({
          medtronicFormIncomplete: false,
          medtronicSerialNumberValue: value
        });
      }
      else if (value.length < 6) {
        this.setState({
          medtronicSerialNumberValue: value,
          medtronicFormIncomplete: true
        });
      }
    }
    else {
      this.setState({
        medtronicSerialNumberValue: '',
        medtronicFormIncomplete: true
      });
    }
  };

  getDebugLinks(data) {

    let post_link = null;

    if(_.isArray(data) || _.isArray(data.post_records)) {

      let filename = 'uploader-processed-records.json';
      let jsonData = null;
      if (_.isArray(data)) {
        jsonData = JSON.stringify(data, undefined, 4);
      } else {
        jsonData = JSON.stringify(data.post_records, undefined, 4);
      }
      let blob = new Blob([jsonData], {type: 'text/json'});
      let dataHref = URL.createObjectURL(blob);
      post_link = (
        <a href={dataHref}
          className={styles.dataDownloadLink}
          download={filename}
          data-downloadurl={['text/json', filename, dataHref].join(':')}>
          POST data
        </a>
      );
    }

    let binary_link = null;
    if(_.isArray(data.pages || data.aapPackets)) {
      /*
        we currently support binary blobs for Medtronic (.pages) and
        Libre (.aapPackets)
      */
      let filenameBinary = 'binary-blob.json';
      let jsonDataBinary = JSON.stringify(data, undefined, 4);
      let blobBinary = new Blob([jsonDataBinary], {type: 'text/json'});
      let dataHrefBinary = URL.createObjectURL(blobBinary);
      binary_link = (
        <a href={dataHrefBinary}
          className={styles.dataDownloadLink}
          download={filenameBinary}
          data-downloadurl={['text/json', filenameBinary, dataHrefBinary].join(':')}>
          Binary blob
        </a>
      );
    }

    if(post_link || binary_link) {
      return (
        <div>
          {post_link}&nbsp;{binary_link}
        </div>
      );
    }
    return null;
  }

  render() {
    return (
      <div className={styles.main}>
        <div className={styles.left}>
          {this.renderName()}
          {this.renderInstructions()}
          {this.renderImage()}
          {this.renderLastUpload()}
        </div>
        <div className={styles.right}>
          <div className={styles.statusSection}>
            {this.renderStatus()}
          </div>
          {this.renderProgress()}
          {this.renderFirstUpload()}
          {this.renderActions()}
        </div>
      </div>
    );
  }

  renderActions() {
    const { upload } = this.props;
    if (upload.uploading) {
      return null;
    }

    if (upload.completed) {
      return (
        <div className={styles.buttonWrap}>
          {this.renderReset()}
        </div>
      );
    }

    return (
      <form className={styles.form}>
        {this.renderCareLinkInputs()}
        {this.renderMedtronicSerialNumberInput()}
        {this.renderBlockModeInput()}
        {this.renderButton()}
      </form>
    );
  }

  renderBlockModeInput() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'block') {
      return null;
    }

    // don't show the 'choose file' button if a file has already been selected.
    if (this.isBlockModeFileChosen()) {
      return null;
    }

    const disabled = upload.disabled || this.props.disabled;

    return (
      <div className={styles.inputWrapper}>
        <input
          className={styles.fileinput}
          disabled={disabled}
          ref="file"
          type="file"
          accept={_.get(upload, 'source.extension')}
          onChange={this.onBlockModeInputChange}/>
      </div>
    );
  }

  renderButton() {
    const { text, upload } = this.props;
    let labelText = text.LABEL_UPLOAD;
    let disabled = upload.disabled || this.props.disabled;

    if (_.get(upload, 'source.type', null) === 'carelink') {
      labelText = text.LABEL_IMPORT;
      disabled = disabled || this.state.carelinkFormIncomplete;
    }

    if (_.get(upload, 'key', null) === 'medtronic') {
      disabled = disabled || this.state.medtronicFormIncomplete;
    }

    if (_.get(upload, 'source.type', null) === 'block') {
      return null;
    }

    return (
      <div className={styles.buttonWrap}>
        <button
          className={styles.button}
          disabled={disabled}
          onClick={disabled ? _.noop : this.handleUpload}
          title={disabled ? 'Upload in progress! Please wait.' : ''}>
          {labelText}
        </button>
      </div>
    );
  }

  renderCareLinkInputs() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'carelink') {
      return null;
    }

    return (
      <div>
        <div className={styles.textInputWrapper}>
          <input
            onChange={this.onCareLinkInputChange}
            className={styles.textInput}
            ref="username"
            placeholder={this.props.text.CARELINK_USERNAME}/>
        </div>
        <div className={styles.textInputWrapper}>
          <input
            onChange={this.onCareLinkInputChange}
            className={styles.textInput}
            ref="password"
            type="password"
            placeholder={this.props.text.CARELINK_PASSWORD}/>
        </div>
      </div>
    );
  }

  renderMedtronicSerialNumberInput() {
    const { upload } = this.props;
    if (_.get(upload, 'source.driverId', null) !== 'Medtronic') {
      return null;
    }

    return (
      <div>
        <div className={styles.textInputWrapper}>
          <p>Enter your 6 digit serial number found on the back of your pump.</p>
          <input
            type="text"
            value={this.state.medtronicSerialNumberValue}
            onChange={this.onMedtronicSerialNumberInputChange}
            className={styles.textInput}
            placeholder={this.props.text.MEDTRONIC_SERIAL_NUMBER} />
          <div className={styles.rememberWrap}>
            <input
              type="checkbox"
              id="medtronicSerialRemember"
              onChange={this.onMedtronicSerialNumberRememberChange}
              checked={this.state.medtronicSerialNumberRemember} />
            <label htmlFor="medtronicSerialRemember">
              {this.props.text.REMEMBER_SERIAL_NUMBER}
            </label>
          </div>
        </div>
      </div>
    );
  }

  renderInstructions() {
    const { upload } = this.props;
    let details = upload.instructions || '';
    if (_.isArray(details)) {
      return (
        <div className={styles.detail}>
          {_.get(details, 0, '')}<br/>
          {_.get(details, 1, '')}
        </div>
      );
    }
    return (
      <div className={styles.detail}>{details}</div>
    );
  }

  renderImage() {
    const { upload } = this.props;
    let image = upload.image || null;

    if (!image) {
      return null;
    }

    return (
      <div className={styles.detail}><img src={image.src} height={image.height} width={image.width} alt={image.alt} /></div>
    );
  }

  renderLastUpload() {
    const { upload } = this.props;
    let history = upload.history;

    if (!(history && history.length)) {
      return null;
    }

    let lastUpload = _.find(history, function(upload) {
      return upload.finish && !upload.error;
    });

    if (lastUpload == null) {
      return null;
    }

    let time = sundial.formatCalendarTime(lastUpload.finish);
    return (
      <div className={styles.detail}>{this.props.text.LAST_UPLOAD + time}</div>
    );
  }

  renderName() {
    const { upload, text } = this.props;
    return (
      <div className={styles.name}>{upload.name || text.DEVICE_UNKNOWN}</div>
    );
  }

  renderProgress() {
    const { upload } = this.props;
    if (upload.failed) {
      return <div className={styles.progress}></div>;
    }

    if (this.isFetchingCareLinkData()) {
      return <div className={styles.progress}><LoadingBar/></div>;
    }

    let percentage = upload.progress && upload.progress.percentage;

    // can be equal to 0, so check for null or undefined
    if (percentage == null) {
      return null;
    }

    return <div className={styles.progress}><ProgressBar percentage={percentage}/></div>;
  }

  renderFirstUpload() {
    const { upload } = this.props;

    if (upload.uploading && upload.progress && upload.progress.isFirstUpload) {
      return (
        <div className={styles.detail}><b>{this.props.text.NOTE}</b>&nbsp;{this.props.text.FIRST_UPLOAD}</div>
      );
    } else {
      return null;
    }
  }

  renderReset() {
    const { upload } = this.props;
    if (!upload.completed) {
      return null;
    }
    let resetClass = cx({
      [styles.resetError]: upload.failed,
      [styles.resetSuccess]: upload.successful
    });

    let text = upload.successful ?
      this.props.text.LABEL_OK : this.props.text.LABEL_FAILED;

    return (
      <div>
        <a href="" onClick={this.handleReset} className={resetClass}>{text}</a>
      </div>
    );
  }

  renderStatus() {
    const { upload } = this.props;
    if (this.isFetchingCareLinkData()) {
      return <div className={styles.status}>{this.props.text.CARELINK_DOWNLOADING}</div>;
    }

    if (upload.uploading) {
      return <div className={styles.status}>{this.props.text.UPLOAD_PROGRESS + this.props.upload.progress.percentage + '%'}</div>;
    }

    if (upload.successful) {
      let dataDownloadLink = null;
      if (debugMode.isDebug && !_.isEmpty(this.props.upload.data)) {
        dataDownloadLink = this.getDebugLinks(this.props.upload.data);
      }
      return <div className={styles.status}>{this.props.text.UPLOAD_COMPLETE}&nbsp;{dataDownloadLink}</div>;
    }

    if(upload.failed) {
      let dataDownloadLink = null;
      if (debugMode.isDebug && this.props.upload.error.data) {
        dataDownloadLink = this.getDebugLinks(this.props.upload.error.data);
      }
      return <div className={styles.status}>{dataDownloadLink}</div>;
    }

    if (this.isBlockModeFileChosen()) {
      return (
          <div className={styles.blockMode}>
            <div className={styles.preparing}>Preparing file &hellip;</div>
            <div className={styles.blockMode}>{this.props.upload.file.name}</div>
          </div>
      );
    }
    return null;
  }

  isBlockModeFileChosen() {
    const { upload } = this.props;
    if (_.get(upload, 'source.type', null) !== 'block') {
      return false;
    }
    else {
      if (!_.isEmpty(_.get(upload, 'file.name', ''))) {
        return true;
      }
      return false;
    }
  }

  isFetchingCareLinkData() {
    const { upload } = this.props;
    return (_.get(upload, 'source.type', null) === 'carelink') &&
      (upload.isFetching);
  }
}
