/**
 * External dependencies
 */
import styled from '@emotion/styled';

/**
 * Internal dependencies
 */
import NumberControl from '../../number-control';
import InnerSelectControl from '../../select-control';
import InnerRangeControl from '../../range-control';
import { StyledField } from '../../base-control/styles/base-control-styles';
import { ThumbWrapper } from '../../range-control/styles/range-control-styles'
import { space } from '../utils/space';
import {
	BackdropUI,
	Container as InputControlContainer,
} from '../../input-control/styles/input-control-styles';
import InputControl from '../../input-control';

export const InputWrapper = styled( InputControl )`
	${ InputControlContainer } {
		padding: 5px 8px;
	}
`;

export const NumberControlWrapper = styled( NumberControl )`
	${ InputControlContainer } {
		width: 96px;
		padding: 5px 6px;
	}
`;

export const SelectControl = styled( InnerSelectControl )`
	margin-left: -8px;
	width: 5em;
	${ BackdropUI } {
		display: none;
	}
`;

export const RangeControl = styled( InnerRangeControl )`
	flex: 1;

	${ StyledField } {
		margin-bottom: 0;
	}
`;

export const AuxiliaryColorArtefactWrapper = styled.div`
	padding: 8px 16px 0px 16px;
`;

export const ColorfulWrapper = styled.div`
	width: 216px;

	.react-colorful {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 216px;
		height: auto;
	}

	.react-colorful__saturation {
		width: 100%;
		border-radius: 0;
		height: 216px;
		margin-bottom: ${ space( 4 ) };
		border-bottom: none;
	}

	.react-colorful__hue,
	.react-colorful__alpha {
		width: 184px;
		height: 16px;
		border-radius: 16px;
		margin-bottom: ${ space( 2 ) };
	}

	.react-colorful__pointer {
		height: 16px;
		width: 16px;
		border: 1.5px solid #ffffff;
		box-shadow: 0px 0px 3px rgba( 0, 0, 0, 0.25 );
	}

	${ StyledField } {
		margin-bottom: 0;
	}

	${ ThumbWrapper } {
		transform: translateX( 4.5px ) scale( 0.75 );
	}
`;
