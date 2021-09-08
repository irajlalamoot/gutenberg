/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { close } from '@wordpress/icons';
import {
	__experimentalLibrary as Library,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { useViewportMatch } from '@wordpress/compose';
import { useDispatch, useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { store as editNavigationStore } from '../../store';
import { useNavigationEditorRootBlock } from '../../hooks';

function InserterSidebar() {
	const SHOW_PREVIEWS = false;

	const isMobileViewport = useViewportMatch( 'medium', '<' );

	const { clientId: navBlockClientId } = useNavigationEditorRootBlock();

	const { hasInserterItems } = useSelect( ( select ) => {
		return {
			hasInserterItems: select( blockEditorStore ).hasInserterItems(
				navBlockClientId
			),
		};
	}, [] );

	const { setIsInserterOpened } = useDispatch( editNavigationStore );

	// Only concerned with whether there are items to display. If not then
	// we shouldn't render.
	if ( ! hasInserterItems ) {
		return null;
	}

	return (
		<div className="edit-navigation-layout__inserter-panel">
			<div className="edit-navigation-layout__inserter-panel-header">
				<Button
					icon={ close }
					onClick={ () => setIsInserterOpened( false ) }
				/>
			</div>
			<div className="edit-navigation-layout__inserter-panel-content">
				<Library
					shouldFocusBlock={ isMobileViewport }
					rootClientId={ navBlockClientId }
					showInserterHelpPanel={ SHOW_PREVIEWS }
					showSearch={ false }
				/>
			</div>
		</div>
	);
}

export default InserterSidebar;
